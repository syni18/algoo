// src/types/env.d.ts

declare namespace NodeJS {
  interface ProcessEnv {
    NODE_ENV: 'development' | 'production' | 'test';
    PORT?: string; // optional string
    DATABASE_URL?: string; // optional string
    SECRET_KEY?: string;
    // Add as many environment variables as your app needs here
  }
}
