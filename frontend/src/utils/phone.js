// 77071234567 -> +7 707 123 45 67 (басқа логиндер өзгеріссіз қалады)
export const prettyPhone = (value) =>
  /^7\d{10}$/.test(value || '')
    ? `+7 ${value.slice(1, 4)} ${value.slice(4, 7)} ${value.slice(7, 9)} ${value.slice(9)}`
    : value;
