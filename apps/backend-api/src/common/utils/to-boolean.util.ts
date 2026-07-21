import { Transform } from 'class-transformer';

export const ToBoolean = () =>
  Transform(
    ({
      value,
      obj,
      key,
    }: {
      value: unknown;
      obj?: Record<string, unknown>;
      key?: string;
    }) => {
      const rawValue = key && obj ? obj[key] : value;

      if (typeof rawValue === 'string') {
        if (rawValue.toLowerCase() === 'true') {
          return true;
        }

        if (rawValue.toLowerCase() === 'false') {
          return false;
        }
      }

      if (value === true || value === false) {
        return value;
      }

      return value;
    },
    { toClassOnly: true },
  );
