# WebGPU validation limit

Command attempted locally: `MUSOU_WEBGPU=1 npm run benchmark -- --grep auto`.

Chromium 156 with `--enable-unsafe-webgpu --use-angle=swiftshader --enable-webgl --ignore-gpu-blocklist` launched the application, then its page process crashed during `page.evaluate` running the benchmark (`Target crashed`). No complete WebGPU measurements were produced. The cause of the browser crash has not been established. A software-adapter experiment is not evidence of real hardware behavior.

Ordinary Chromium auto selection without unsafe flags selects WebGL2 in this environment. Both auto and explicit WebGL2 runs complete all 0/20/100/300 measurements; the JSON records the actual backend and SwiftShader adapter. An explicit WebGPU preference is tested to fall back when the API is unavailable. WebGPU implementation uses Babylon's engine and built-in WGSL material path, but real hardware WebGPU remains unverified. No performance claim is made for it.
