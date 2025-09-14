import moment from "moment";
import "moment-timezone";


export function timestampFormatGmt(input: string | number | Date): string {
  if (typeof input === "number") {
    return (input.toString().length === 10
      ? moment.unix(input)
      : moment(input)
    ).tz("Asia/Kolkata").format("DD-MM-YYYY HH:mm:ss");
  }

  return moment(input).tz("Asia/Kolkata").format("DD-MM-YYYY HH:mm:ss");
}

export function timestampFormatUtc(input: string | number | Date): string {
  if (typeof input === "number") {
    return (input.toString().length === 10
      ? moment.unix(input)
      : moment(input)
    ).utc().format("YYYY-MM-DD HH:mm:ss [UTC]");
  }

  return moment(input).utc().format("YYYY-MM-DD HH:mm:ss [UTC]");
}