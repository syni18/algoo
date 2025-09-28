// src/routes/auth.ts
import { Router } from 'express';

import { loginUser, createUser, usernameExists } from '../../controllers/v1-CTRL/auth';
import { Route } from '../../interfaces';
import { catchAsync } from '../../middlewares/catchAsync';

const router = Router();
// const authMethods = ["email"]
const routes: Route[] = [
  {
    method: 'get',
    path: '/isusernametaken/:username',
    handler: catchAsync(usernameExists),
  },
  {
    method: 'post',
    path: '/login',
    handler: catchAsync(loginUser),
  },
  {
    method: 'post',
    path: '/register',
    handler: catchAsync(createUser),
  },
];

// Dynamically register routes
routes.forEach((route) => {
  const middlewares = route.middleware ? [...route.middleware] : [];
  if (route.validationSchema) {
    // middlewares.push(validate(route.validationSchema));
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
