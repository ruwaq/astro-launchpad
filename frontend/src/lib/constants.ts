/**
 * Constantes de UI compartidas por varios formularios de AstroGate.
 * Nada de cifras económico-criticas: las vivas viven en lib/tokenomics.ts
 * y las de red en lib/network.ts. Aquí solo configuración de interfaz.
 */

/** Incrementos de porcentaje del saldo que ofrece la UI en todas las cards. */
export const AMOUNT_PERCENTS = [25, 50, 75, 100] as const

/** Mensaje estándar cuando no se puede preparar el firmante activo. */
export const UNSUPPORTED_SIGNER_MESSAGE =
  'Unable to prepare signer for the active account.'

/** Tamaño máximo aceptado para el logo de un token (bytes). */
export const LOGO_MAX_BYTES = 500_000

/** Clase base de inputs de formulario (design token de las cards). */
export const FORM_INPUT_CLASS =
  'w-full rounded-lg border border-slate-800 bg-slate-950 px-3.5 py-3 text-base text-slate-100 outline-none focus:border-emerald-500'
