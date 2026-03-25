#!/usr/bin/env node

import { run } from '@oclif/core';
import { handle } from '@oclif/core/handle';

void run(undefined, import.meta.url).catch(handle);
