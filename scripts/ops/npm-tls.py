#!/usr/bin/env python3
"""
TLS en Nginx Proxy Manager con Let's Encrypt.            (auditoría N23, plan B de N42)

Hoy NPM sólo escucha en :80 y Cloudflare va en modo Flexible: el tramo
Cloudflare → Oracle viaja en HTTP plano. Este script, por la API de NPM:

  1. pide (o reutiliza) UN certificado Let's Encrypt para helpdesklite.me y
     staging.helpdesklite.me,
  2. lo asigna a los proxy hosts de esos dominios (HTTP/2 activado; sin
     forzar HTTPS todavía: con Cloudflare en Flexible eso haría un bucle de
     redirecciones),
  3. cambia la página por defecto de NPM ("Congratulations") por una
     respuesta vacía (444), que no delata el producto.

Después, fuera del servidor: Cloudflare → SSL/TLS → Full (strict). Y sólo
entonces, si se quiere: --force-ssl (redirección 80 → 443 en NPM).

Uso (en el servidor):
    sudo python3 scripts/ops/npm-tls.py [--force-ssl] [--prune-nip] [--dry-run]

Credenciales (nunca por argumento ni por el chat): /root/.npm-admin, 600, con
    NPM_EMAIL=...            # el admin de NPM
    NPM_PASSWORD=...
    CF_DNS_API_TOKEN=...     # opcional: token de Cloudflare "Edit zone DNS"
Si falta el fichero, se piden por teclado.

Validación ante Let's Encrypt:
  - Con CF_DNS_API_TOKEN: DNS-01 (certbot-dns-cloudflare). No depende del WAF
    ni del camino HTTP: es la opción robusta y la que sigue funcionando en el
    plan B (DNS only) o con el origen cerrado.
  - Sin él: HTTP-01 a través de Cloudflare. Exige que la ruta
    /.well-known/acme-challenge/ no esté desafiada en staging (regla Skip).
"""
import argparse, getpass, json, os, ssl, subprocess, sys, time, urllib.request, urllib.error

API = "http://127.0.0.1:81/api"
DOMAINS = ["helpdesklite.me", "staging.helpdesklite.me"]
CRED_FILE = "/root/.npm-admin"
# Campos que acepta PUT /nginx/proxy-hosts/{id} (el esquema rechaza los demás).
PUT_FIELDS = ("domain_names", "forward_scheme", "forward_host", "forward_port",
              "certificate_id", "ssl_forced", "hsts_enabled", "hsts_subdomains",
              "http2_support", "block_exploits", "caching_enabled",
              "allow_websocket_upgrade", "access_list_id", "advanced_config",
              "enabled", "meta", "locations")

def log(msg): print("\n==> " + msg)
def die(msg): print("ERROR: " + msg, file=sys.stderr); sys.exit(1)

def creds():
    env = {}
    if os.path.exists(CRED_FILE):
        if os.stat(CRED_FILE).st_mode & 0o077:
            die(CRED_FILE + " debe ser 600 (chmod 600).")
        for line in open(CRED_FILE):
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1); env[k.strip()] = v.strip()
    email = env.get("NPM_EMAIL") or input("Email del admin de NPM: ")
    pw = env.get("NPM_PASSWORD") or getpass.getpass("Contraseña de NPM: ")
    return email, pw, env.get("CF_DNS_API_TOKEN", "")

class Npm:
    def __init__(self, email, pw):
        self.token = self.call("POST", "/tokens", {"identity": email, "secret": pw}, auth=False)["token"]
    def call(self, method, path, body=None, auth=True, timeout=60):
        data = json.dumps(body).encode() if body is not None else None
        req = urllib.request.Request(API + path, data=data, method=method)
        req.add_header("Content-Type", "application/json")
        if auth: req.add_header("Authorization", "Bearer " + self.token)
        try:
            with urllib.request.urlopen(req, timeout=timeout) as r:
                raw = r.read()
                return json.loads(raw) if raw else {}
        except urllib.error.HTTPError as e:
            detail = e.read().decode(errors="replace")[:600]
            die("%s %s → HTTP %s: %s" % (method, path, e.code, detail))

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--force-ssl", action="store_true", help="redirigir 80→443 en NPM (SÓLO con Cloudflare ya en Full (strict))")
    ap.add_argument("--prune-nip", action="store_true", help="borrar los proxy hosts antiguos *.nip.io")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()
    if os.geteuid() != 0: die("ejecuta con sudo (para leer " + CRED_FILE + ").")

    email, pw, cf_token = creds()
    npm = Npm(email, pw)
    log("Autenticado en NPM como " + email[:2] + "…")

    # 1. certificado: reutilizar si ya hay uno vigente para los dos dominios
    certs = [c for c in npm.call("GET", "/nginx/certificates") if not c.get("is_deleted")]
    cert = next((c for c in certs if set(DOMAINS) <= set(c["domain_names"])
                 and c.get("expires_on", "0000") > time.strftime("%Y-%m-%d")), None)
    if cert:
        log("Certificado existente #%d (%s, caduca %s): se reutiliza." % (cert["id"], cert["provider"], cert["expires_on"]))
    else:
        meta = {"letsencrypt_email": email, "letsencrypt_agree": True, "dns_challenge": False}
        if cf_token:
            meta.update({"dns_challenge": True, "dns_provider": "cloudflare",
                         "dns_provider_credentials": "dns_cloudflare_api_token = " + cf_token,
                         "propagation_seconds": 30})
            log("Pidiendo certificado Let's Encrypt por DNS-01 (Cloudflare) para " + ", ".join(DOMAINS))
        else:
            log("Pidiendo certificado Let's Encrypt por HTTP-01 para " + ", ".join(DOMAINS)
                + "\n    (staging debe dejar pasar /.well-known/acme-challenge/ en el WAF)")
        if args.dry_run:
            print("  [dry-run] POST /nginx/certificates"); cert = {"id": 0}
        else:
            cert = npm.call("POST", "/nginx/certificates",
                            {"provider": "letsencrypt", "domain_names": DOMAINS, "meta": meta}, timeout=420)
            log("Certificado #%d emitido, caduca %s." % (cert["id"], cert.get("expires_on", "?")))

    # 2. asignarlo a los proxy hosts de esos dominios
    hosts = npm.call("GET", "/nginx/proxy-hosts")
    for h in hosts:
        if not (set(h["domain_names"]) & set(DOMAINS)): continue
        body = {k: h[k] for k in PUT_FIELDS if k in h}
        body.update({"certificate_id": cert["id"], "http2_support": True, "hsts_enabled": False,
                     "ssl_forced": bool(args.force_ssl)})
        log("Proxy host #%d %s → cert #%d, http2, ssl_forced=%s" % (h["id"], h["domain_names"], cert["id"], body["ssl_forced"]))
        if not args.dry_run: npm.call("PUT", "/nginx/proxy-hosts/%d" % h["id"], body)

    # 3. hosts antiguos por IP (nip.io)
    if args.prune_nip:
        for h in hosts:
            if any(d.endswith(".nip.io") for d in h["domain_names"]):
                log("Borrando proxy host #%d %s" % (h["id"], h["domain_names"]))
                if not args.dry_run: npm.call("DELETE", "/nginx/proxy-hosts/%d" % h["id"])

    # 4. página por defecto: 444 (cierra la conexión sin respuesta)
    log("Página por defecto de NPM → 444")
    if not args.dry_run: npm.call("PUT", "/settings/default-site", {"value": "444", "meta": {}})

    if args.dry_run: return
    # 5. comprobación local: el :443 presenta el certificado correcto
    log("Comprobación")
    for d in DOMAINS:
        try:
            out = subprocess.run(["sh", "-c", "echo | openssl s_client -connect 127.0.0.1:443 -servername %s 2>/dev/null | openssl x509 -noout -issuer -enddate" % d],
                                 capture_output=True, text=True, timeout=20).stdout.strip().replace("\n", " | ")
            print("  %-26s %s" % (d, out or "(sin certificado en :443)"))
        except Exception as e:
            print("  %-26s error: %s" % (d, e))
    print("\nSiguiente paso (fuera del servidor): Cloudflare → SSL/TLS → Overview → Full (strict).\n"
          "Después, opcional: sudo python3 scripts/ops/npm-tls.py --force-ssl")

if __name__ == "__main__":
    main()
