#!/usr/bin/env -S pnpm exec tsx --conditions=development --env-file=.env.development

import { NodeRuntime } from '@effect/platform-node';
import { Layer } from 'effect';

import { AppServicesLive } from '#app.js';
import { HttpLive } from '#server.js';

const MainLive = HttpLive.pipe(Layer.provide(AppServicesLive));

NodeRuntime.runMain(Layer.launch(MainLive));
