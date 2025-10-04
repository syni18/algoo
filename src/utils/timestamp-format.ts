import 'moment-timezone';

import moment from 'moment';

export function timestampFormatGmt(input: string | number | Date): string {
  if (typeof input === 'number') {
    return (input.toString().length === 10 ? moment.unix(input) : moment(input))
      .tz('Asia/Kolkata')
      .format('YYYY-MM-DD HH:mm:ss');
  }

  return moment(input).tz('Asia/Kolkata').format('YYYY-MM-DD HH:mm:ss');
}

export function timestampFormatUtc(input: string | number | Date): string {
  if (typeof input === 'number') {
    return (input.toString().length === 10 ? moment.unix(input) : moment(input))
      .utc()
      .format('YYYY-MM-DD HH:mm:ss [UTC]');
  }

  return moment(input).utc().format('YYYY-MM-DD HH:mm:ss [UTC]');
}
