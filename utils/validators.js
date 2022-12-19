export const string = (val) => val?.constructor === String
export const iso8861Date = (val) => val?.match?.(/\d{4}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d:[0-5]\d([+-][0-2]\d:[0-5]\d|Z)/)
export const base64 = (val) => val?.match?.(/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/)
export const sha256WithPrefix = (val) => val?.match?.(/^sha256:[A-Fa-f0-9]{64}$/)
