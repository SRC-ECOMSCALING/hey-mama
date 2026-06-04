declare module "cookie-signature" {
  export function sign(value: string, secret: string): string;
  export function unsign(input: string, secret: string): string | false;
  const _default: { sign: typeof sign; unsign: typeof unsign };
  export default _default;
}
