#!/usr/bin/env node
import { envStartSchema, type EnvStartConfig } from './config.js';
import { startSTDIO } from './stdio.js';
import { startStreamableHTTP } from './streamable-http.js';

const ENV: EnvStartConfig = envStartSchema.parse(process.env);

if (ENV.TRANSPORT === "stdio") {
    startSTDIO();
}
else {
    startStreamableHTTP();
}
