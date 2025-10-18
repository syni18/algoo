// src/routes/auth.ts
import { Router } from 'express';

import { 
  createUser, 
  loginUser, 
  usernameExists, 
  deleteUser,
  logoutUser, 
  forgetUser, 
  resetUser,
  changePassword
} from '../../controllers/v1-CTRL/auth';
import { Route } from '../../interfaces';
import { catchAsync } from '../../middlewares/catchAsync';
import { validateRequest } from '../../middlewares/validateRequest';
import { 
  createUserInputSchema, 
  usernameInputSchema, 
  loginUserInputSchema, 
  deleteUserInputSchema, 
  forgetUserInputSchema, 
  resetUserInputSchema, 
  resetTokenSchema,
  changePasswordInputSchema 
} from '../../validation/user';

const router = Router();
// const authMethods = ["email"]
const routes: Route[] = [
  {
    method: 'get',
    path: '/isusernametaken/:username',
    validationSchema: validateRequest(usernameInputSchema, 'params'),
    handler: catchAsync(usernameExists),
  },
  {
    method: 'post',
    path: '/login',
    validationSchema: validateRequest(loginUserInputSchema, 'body'),
    handler: catchAsync(loginUser),
  },
  {
    method: 'post',
    path: '/register',
    validationSchema: validateRequest(createUserInputSchema, 'body'),
    handler: catchAsync(createUser),
  },
  {
    method: 'delete',
    path: '/delete-account',
    validationSchema: validateRequest(deleteUserInputSchema, 'body'),
    handler: catchAsync(deleteUser),
  },
  {
    method: 'post',
    path: '/logout',
    // validationSchema:
    handler: catchAsync(logoutUser),
  },
  {
    method: 'post',
    path: '/forget-password',
    validationSchema: validateRequest(forgetUserInputSchema, 'body'),
    handler: catchAsync(forgetUser),
  },
  {
    method: 'put',
    path: '/reset-password/:token',
    validationSchema: [
      validateRequest(resetUserInputSchema, 'body'),
      validateRequest(resetTokenSchema, 'params')
    ],
    handler: catchAsync(resetUser),
  },
  {
    method: 'put',
    path: '/change-password',
    validationSchema: validateRequest(changePasswordInputSchema, 'body'),
    handler: catchAsync(changePassword),
  }
];

// Dynamically register routes
routes.forEach((route) => {
  const middlewares = route.middleware ? [...route.middleware] : [];
  if (route.validationSchema) {
    middlewares.push(route.validationSchema);
  }
  if (middlewares.length > 0) {
    router[route.method](route.path, ...middlewares, route.handler);
  } else {
    router[route.method](route.path, route.handler);
  }
});

export default {
  basePath: '/auth',
  router,
};
