#!/usr/bin/env python3
"""
Security list de la VCN de Oracle: 80/443 sólo desde Cloudflare.   (auditoría B2 / N3)

Primera capa del cierre del origen (la segunda es DOCKER-USER en el host,
scripts/ops/origin-cloudflare-only.sh). Descarga la lista OFICIAL de rangos
de Cloudflare, conserva las reglas que no son web (22, ICMP…) y deja 80 y
443 exactamente con esos rangos. Muestra el diff y sólo escribe con --apply.

Uso (en el portátil, con la sesión de OCI abierta):
    oci session authenticate --region eu-frankfurt-1     # una vez, navegador
    python3 scripts/ops/vcn-cloudflare-ingress.py              # ver diff
    python3 scripts/ops/vcn-cloudflare-ingress.py --apply      # aplicar
    python3 scripts/ops/vcn-cloudflare-ingress.py --open-web --apply   # plan B (N42): 80/443 a todo el mundo
    python3 scripts/ops/vcn-cloudflare-ingress.py --apply      # vuelta al cierre

Localiza la instancia por su nombre (--instance, por defecto la única en
RUNNING) y toma la security list de su subred. Guarda una copia de la lista
anterior en el scratch antes de aplicar.
"""
import argparse, ipaddress, json, subprocess, sys, tempfile, time, urllib.request

CF_V4 = "https://www.cloudflare.com/ips-v4"
WEB_PORTS = (80, 443)

def oci(*args):
    cmd = ["oci", "--auth", "security_token", *args, "--output", "json"]
    # stdin cerrado: con la sesión caducada, oci pregunta «re-authenticate?»
    # y se quedaría esperando para siempre. Mejor fallar y decirlo.
    r = subprocess.run(cmd, capture_output=True, text=True, stdin=subprocess.DEVNULL)
    if r.returncode != 0:
        err = r.stderr + r.stdout
        if "session has expired" in err or "NotAuthenticated" in err or "re-authenticate" in err:
            sys.exit("la sesión de OCI ha caducado (dura 1 h): oci session authenticate --region eu-frankfurt-1")
        sys.exit("oci %s → %s" % (" ".join(args[:3]), r.stderr.strip()[-400:]))
    return json.loads(r.stdout)["data"] if r.stdout.strip() else None

def tcp_rule(source, port, description):
    return {"description": description, "icmp-options": None, "is-stateless": False,
            "protocol": "6", "source": source, "source-type": "CIDR_BLOCK",
            "tcp-options": {"destination-port-range": {"max": port, "min": port}, "source-port-range": None},
            "udp-options": None}

def is_private(cidr):
    try:
        return ipaddress.ip_network(cidr, strict=False).is_private
    except ValueError:
        return False

def permits_web(rule):
    """True si la regla deja pasar 80 o 443 desde una fuente PÚBLICA: TCP con
    un rango que los cubra (o sin rango = todos los puertos) o protocolo
    'all'. Las fuentes privadas (VCN, RFC1918) no cuentan: no son el origen
    abierto a internet que se quiere cerrar."""
    if rule.get("source-type", "CIDR_BLOCK") != "CIDR_BLOCK" or is_private(rule.get("source", "")):
        return False
    proto = rule.get("protocol")
    if proto == "all":
        return True
    if proto != "6":
        return False
    pr = (rule.get("tcp-options") or {}).get("destination-port-range")
    if not pr:
        return True  # TCP sin rango = todos los puertos
    return any(pr["min"] <= p <= pr["max"] for p in WEB_PORTS)

def is_web(rule):
    """Regla web nuestra: TCP, un solo puerto 80 o 443 (las de Cloudflare)."""
    pr = (rule.get("tcp-options") or {}).get("destination-port-range") or {}
    return rule.get("protocol") == "6" and pr.get("min") in WEB_PORTS and pr.get("min") == pr.get("max")

def key(rule):
    t = (rule.get("tcp-options") or {}).get("destination-port-range") or {}
    return (rule.get("protocol"), rule.get("source"), t.get("min"), t.get("max"))

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--instance", help="display-name de la instancia (por defecto: la única RUNNING)")
    ap.add_argument("--open-web", action="store_true", help="plan B: 80/443 desde 0.0.0.0/0 (además de Cloudflare)")
    ap.add_argument("--apply", action="store_true")
    a = ap.parse_args()

    tenancy = None
    for line in open(__import__("os").path.expanduser("~/.oci/config")):
        if line.startswith("tenancy="): tenancy = line.split("=", 1)[1].strip()
    if not tenancy: sys.exit("no encuentro tenancy= en ~/.oci/config")

    inst = [i for i in oci("compute", "instance", "list", "--compartment-id", tenancy,
                           "--compartment-id-in-subtree", "true", "--all")
            if i["lifecycle-state"] == "RUNNING" and (not a.instance or i["display-name"] == a.instance)]
    if len(inst) != 1: sys.exit("instancias RUNNING encontradas: %d (usa --instance)" % len(inst))
    inst = inst[0]
    vnic = oci("compute", "instance", "list-vnics", "--instance-id", inst["id"])[0]
    subnet = oci("network", "subnet", "get", "--subnet-id", vnic["subnet-id"])
    # Una subred puede llevar hasta 5 security lists y sus reglas se SUMAN:
    # se gestiona la primera y se exige que ninguna otra abra 80/443.
    lists = [oci("network", "security-list", "get", "--security-list-id", i) for i in subnet["security-list-ids"]]
    sl, others = lists[0], lists[1:]
    sl_id, current = sl["id"], sl["ingress-security-rules"]
    print("instancia %s · subred %s · security list «%s» (%d reglas de entrada; %d listas más en la subred)"
          % (inst["display-name"], subnet["display-name"], sl["display-name"], len(current), len(others)))
    for o in others:
        bad = [r for r in o["ingress-security-rules"] if permits_web(r)]
        if bad:
            for r in bad: print("  ! «%s»: %s %s" % (o["display-name"], r.get("protocol"), r.get("source")))
            sys.exit("la security list «%s» también abre 80/443 a internet: quítalo allí primero (este script sólo gestiona la primera lista)." % o["display-name"])

    with urllib.request.urlopen(CF_V4, timeout=20) as r:
        cf = sorted(l.strip() for l in r.read().decode().splitlines() if l.strip())
    # Sin esta comprobación, una respuesta vacía o una página intermedia
    # dejaría el origen sin ninguna regla web con --apply.
    if len(cf) < 10:
        sys.exit("lista IPv4 de Cloudflare vacía o sospechosamente corta (%d entradas): no se aplica nada." % len(cf))
    for cidr in cf:
        try:
            ipaddress.IPv4Network(cidr)
        except ValueError:
            sys.exit("entrada no válida en la lista de Cloudflare: %r. No se aplica nada." % cidr)
    print("rangos IPv4 de Cloudflare hoy: %d" % len(cf))

    # Se quitan nuestras reglas web (se regeneran) y cualquier otra que abra
    # 80/443 desde internet (rangos que los incluyan, TCP sin rango, 'all').
    dropped = [r for r in current if not is_web(r) and permits_web(r)]
    for r in dropped:
        print("  - se retira (abre 80/443 a internet): %s %s %s" % (r.get("protocol"), r.get("source"), r.get("description") or ""))
    desired = [r for r in current if not is_web(r) and not permits_web(r)]
    for port, name in ((80, "HTTP"), (443, "HTTPS")):
        for cidr in cf:
            desired.append(tcp_rule(cidr, port, "Cloudflare %s" % name))
        if a.open_web:
            desired.append(tcp_rule("0.0.0.0/0", port, "PLAN B N42: abierto temporalmente"))

    cur, des = {key(r) for r in current}, {key(r) for r in desired}
    add, rem = sorted(des - cur, key=str), sorted(cur - des, key=str)
    for k in add: print("  + %s %s :%s" % (k[0], k[1], k[2]))
    for k in rem: print("  - %s %s :%s" % (k[0], k[1], k[2]))
    if not add and not rem:
        print("sin cambios: la security list ya es exactamente la deseada."); return
    if not a.apply:
        print("(%d por añadir, %d por quitar; nada aplicado: usa --apply)" % (len(add), len(rem))); return

    backup = tempfile.NamedTemporaryFile("w", prefix="security-list-%s-" % time.strftime("%Y%m%d-%H%M%S"),
                                         suffix=".json", delete=False)
    json.dump(sl, backup, indent=1); backup.close()
    rules_file = tempfile.NamedTemporaryFile("w", suffix=".json", delete=False)
    json.dump(desired, rules_file); rules_file.close()
    oci("network", "security-list", "update", "--security-list-id", sl_id,
        "--ingress-security-rules", "file://" + rules_file.name, "--force")
    print("aplicado (%d reglas). Copia de la lista anterior: %s" % (len(desired), backup.name))

if __name__ == "__main__":
    main()
