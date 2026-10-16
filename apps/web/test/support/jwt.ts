/**
 * Un access token con `exp` dentro de `seconds` segundos. El cliente sólo lee
 * `exp` para decidir si renueva antes de usarlo; la firma la valida la API, así
 * que aquí no hace falta una de verdad.
 */
export function jwt(seconds: number): string {
  const encode = (value: unknown) =>
    btoa(JSON.stringify(value))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  return [
    encode({ alg: 'HS256', typ: 'JWT' }),
    encode({ sub: 'test', exp: Math.floor(Date.now() / 1000) + seconds }),
    'firma',
  ].join('.');
}
