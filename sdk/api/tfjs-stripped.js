/*
 * This file is part of eyeo's Web Extension Ad Blocking Toolkit (EWE),
 * Copyright (C) 2006-present eyeo GmbH
 *
 * EWE is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3 as
 * published by the Free Software Foundation.
 *
 * EWE is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with EWE.  If not, see <http://www.gnu.org/licenses/>.
 */

export {
  cast, stack, unstack, enableProdMode, tidy,
  tensor, eye, pow, sum, isFinite, zeros, oneHot} from "@tensorflow/tfjs-core";
export {loadGraphModel} from "@tensorflow/tfjs-converter";

import "@tensorflow/tfjs-core/dist/public/chained_ops/pad.js";
import "@tensorflow/tfjs-core/dist/public/chained_ops/where.js";
import "@tensorflow/tfjs-core/dist/public/chained_ops/mul.js";
import "@tensorflow/tfjs-core/dist/public/chained_ops/dot.js";
import "@tensorflow/tfjs-core/dist/public/chained_ops/add.js";

import {registerKernel} from "@tensorflow/tfjs-core";
import "@tensorflow/tfjs-backend-webgl/dist/base.js";

import {addConfig} from "@tensorflow/tfjs-backend-webgl/dist/kernels/Add.js";
import {sumConfig} from "@tensorflow/tfjs-backend-webgl/dist/kernels/Sum.js";
import {powConfig} from "@tensorflow/tfjs-backend-webgl/dist/kernels/Pow.js";
import {packConfig} from "@tensorflow/tfjs-backend-webgl/dist/kernels/Pack.js";
import {castConfig} from "@tensorflow/tfjs-backend-webgl/dist/kernels/Cast.js";
import {reluConfig} from "@tensorflow/tfjs-backend-webgl/dist/kernels/Relu.js";
import {meanConfig} from "@tensorflow/tfjs-backend-webgl/dist/kernels/Mean.js";
import {prodConfig} from "@tensorflow/tfjs-backend-webgl/dist/kernels/Prod.js";
import {padV2Config}
  from "@tensorflow/tfjs-backend-webgl/dist/kernels/PadV2.js";
import {unpackConfig}
  from "@tensorflow/tfjs-backend-webgl/dist/kernels/Unpack.js";
import {reshapeConfig}
  from "@tensorflow/tfjs-backend-webgl/dist/kernels/Reshape.js";
import {isFiniteConfig}
  from "@tensorflow/tfjs-backend-webgl/dist/kernels/IsFinite.js";
import {identityConfig}
  from "@tensorflow/tfjs-backend-webgl/dist/kernels/Identity.js";
import {selectConfig}
  from "@tensorflow/tfjs-backend-webgl/dist/kernels/Select.js";
import {multiplyConfig}
  from "@tensorflow/tfjs-backend-webgl/dist/kernels/Multiply.js";
import {batchMatMulConfig}
  from "@tensorflow/tfjs-backend-webgl/dist/kernels/BatchMatMul.js";
import {gatherV2Config}
  from "@tensorflow/tfjs-backend-webgl/dist/kernels/GatherV2.js";
import {concatConfig}
  from "@tensorflow/tfjs-backend-webgl/dist/kernels/Concat.js";
import {sigmoidConfig}
  from "@tensorflow/tfjs-backend-webgl/dist/kernels/Sigmoid.js";
import {_fusedMatMulConfig}
  from "@tensorflow/tfjs-backend-webgl/dist/kernels/_FusedMatMul.js";

for (let config of [addConfig, sumConfig, powConfig, packConfig,
                    castConfig, reluConfig, meanConfig, prodConfig,
                    padV2Config, unpackConfig, reshapeConfig,
                    isFiniteConfig, identityConfig, selectConfig,
                    multiplyConfig, batchMatMulConfig, gatherV2Config,
                    concatConfig, sigmoidConfig, _fusedMatMulConfig])
  registerKernel(config);
