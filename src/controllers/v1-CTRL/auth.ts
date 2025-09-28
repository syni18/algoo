import { Request, Response } from "express";
import { checkUsernameExists } from "../../services/v1-SVC/auth";
import { sendResponse } from "../../utils/sendResponse";

export const usernameExists = async (req: Request, res: Response) => {
  const username = (req.params.username as string)?.trim();

  const r = await checkUsernameExists(username);
  return sendResponse({
    res,
    statusCode: 200,
    success: true,
    data: r || null,
    message: 'Username validation successful',
  });
};
export const loginUser = async (req: Request, res: Response) => {
  // Login logic here
};

export const createUser = async (req: Request, res: Response) => {
  // Registration logic here
};
