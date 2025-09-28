import { HttpError } from "../../errors/HttpError";
import logger from "logger/winston-logger";
import bloomFilterService from "../../utils/bloomFilter";
import { query } from "../../config/postgres";

export const checkUsernameExists = async (username: string): Promise<object> => {
  if (!username) {
    throw new HttpError("Invalid username", 400);
  }

  // First check Bloom filter
  if (!bloomFilterService.isUsernamePossiblyTaken(username)) {
    return { 
        available: true, 
        message: `Username '${username}' is available` 
    };
  }

  const q = `SELECT 1 FROM users WHERE username = $1 LIMIT 1`;
  const r = await query(q, [username]);

  return { 
    available: (r.rowCount ?? 0) === 0, 
    message: `Username '${username}' is ${(r.rowCount ?? 0) === 0 ? 'available' : 'not available'}` 
    };
};
