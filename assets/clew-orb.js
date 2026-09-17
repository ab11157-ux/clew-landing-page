(() => {
  const canvas = document.getElementById('clew-orb-canvas');
  if (!canvas) return;

  const gl = canvas.getContext('webgl', {
    alpha: true,
    antialias: true,
    premultipliedAlpha: true,
    powerPreference: 'high-performance'
  });
  if (!gl) return;

  const vertexSource = `
    attribute vec3 aPosition;
    attribute vec3 aNormal;
    attribute float aTone;
    uniform mat4 uProjection;
    uniform mat4 uView;
    uniform mat4 uModel;
    varying vec3 vNormal;
    varying vec3 vWorld;
    varying float vTone;
    void main() {
      vec4 world = uModel * vec4(aPosition, 1.0);
      vWorld = world.xyz;
      vNormal = normalize(mat3(uModel) * aNormal);
      vTone = aTone;
      gl_Position = uProjection * uView * world;
    }
  `;

  const fragmentSource = `
    precision highp float;
    varying vec3 vNormal;
    varying vec3 vWorld;
    varying float vTone;
    void main() {
      vec3 normal = normalize(vNormal);
      vec3 viewDir = normalize(vec3(0.0, 0.0, 4.7) - vWorld);
      vec3 key = normalize(vec3(-0.62, 0.78, 0.82));
      vec3 fill = normalize(vec3(0.75, -0.12, 0.55));
      float diffuse = max(dot(normal, key), 0.0);
      float coolFill = max(dot(normal, fill), 0.0);
      float rim = pow(1.0 - max(dot(normal, viewDir), 0.0), 2.4);
      float specular = pow(max(dot(reflect(-key, normal), viewDir), 0.0), 30.0);
      vec3 shadowPearl = vec3(0.13, 0.15, 0.17);
      vec3 softSilver = vec3(0.68, 0.72, 0.75);
      vec3 champagne = vec3(1.0, 0.92, 0.77);
      vec3 color = mix(shadowPearl, softSilver, 0.30 + diffuse * 0.62);
      color = mix(color, champagne, specular * 0.60 + vTone * 0.035);
      color += vec3(0.28, 0.48, 0.62) * coolFill * 0.20;
      color += vec3(0.52, 0.71, 0.82) * rim * 0.34;
      gl_FragColor = vec4(color, 1.0);
    }
  `;

  const compile = (type, source) => {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  };

  const vertexShader = compile(gl.VERTEX_SHADER, vertexSource);
  const fragmentShader = compile(gl.FRAGMENT_SHADER, fragmentSource);
  if (!vertexShader || !fragmentShader) return;

  const program = gl.createProgram();
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return;
  gl.useProgram(program);

  let seed = 92817;
  const random = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const normalize = (v) => {
    const length = Math.hypot(v[0], v[1], v[2]) || 1;
    return [v[0] / length, v[1] / length, v[2] / length];
  };
  const cross = (a, b) => [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0]
  ];
  const rotateXYZ = (p, rx, ry, rz) => {
    let [x, y, z] = p;
    let c = Math.cos(rx), s = Math.sin(rx);
    [y, z] = [y * c - z * s, y * s + z * c];
    c = Math.cos(ry); s = Math.sin(ry);
    [x, z] = [x * c + z * s, -x * s + z * c];
    c = Math.cos(rz); s = Math.sin(rz);
    [x, y] = [x * c - y * s, x * s + y * c];
    return [x, y, z];
  };

  const positions = [];
  const normals = [];
  const tones = [];
  const indices = [];
  const radialSegments = 6;
  const pathSegments = 74;

  const addTube = (strand) => {
    const start = positions.length / 3;
    const turns = 1.8 + random() * 1.8;
    const phase = random() * Math.PI * 2;
    const wobblePhase = random() * Math.PI * 2;
    const radius = 1.02 + (random() - .5) * .07;
    const tubeRadius = .017 + random() * .014;
    const rx = random() * Math.PI;
    const ry = random() * Math.PI;
    const rz = random() * Math.PI;
    const points = [];

    for (let i = 0; i <= pathSegments; i += 1) {
      const u = i / pathSegments;
      const longitude = phase + u * Math.PI * 2 * turns;
      const latitude = Math.sin(u * Math.PI * 2 + wobblePhase) * (.32 + random() * .025) +
        Math.sin(u * Math.PI * 5 + phase) * .08;
      const r = radius + Math.sin(u * Math.PI * 8 + strand) * .018;
      points.push(rotateXYZ([
        Math.cos(latitude) * Math.cos(longitude) * r,
        Math.sin(latitude) * r,
        Math.cos(latitude) * Math.sin(longitude) * r
      ], rx, ry, rz));
    }

    for (let i = 0; i <= pathSegments; i += 1) {
      const previous = points[Math.max(0, i - 1)];
      const next = points[Math.min(pathSegments, i + 1)];
      const tangent = normalize([next[0] - previous[0], next[1] - previous[1], next[2] - previous[2]]);
      const outward = normalize(points[i]);
      let side = normalize(cross(tangent, outward));
      if (Math.hypot(...side) < .1) side = normalize(cross(tangent, [0, 1, 0]));
      const up = normalize(cross(side, tangent));

      for (let j = 0; j < radialSegments; j += 1) {
        const angle = j / radialSegments * Math.PI * 2;
        const normal = normalize([
          side[0] * Math.cos(angle) + up[0] * Math.sin(angle),
          side[1] * Math.cos(angle) + up[1] * Math.sin(angle),
          side[2] * Math.cos(angle) + up[2] * Math.sin(angle)
        ]);
        positions.push(
          points[i][0] + normal[0] * tubeRadius,
          points[i][1] + normal[1] * tubeRadius,
          points[i][2] + normal[2] * tubeRadius
        );
        normals.push(...normal);
        tones.push((strand % 7) / 7);
      }
    }

    for (let i = 0; i < pathSegments; i += 1) {
      for (let j = 0; j < radialSegments; j += 1) {
        const a = start + i * radialSegments + j;
        const b = start + i * radialSegments + (j + 1) % radialSegments;
        const c = start + (i + 1) * radialSegments + j;
        const d = start + (i + 1) * radialSegments + (j + 1) % radialSegments;
        indices.push(a, c, b, b, c, d);
      }
    }
  };

  for (let strand = 0; strand < 72; strand += 1) addTube(strand);

  const bindBuffer = (name, values, size) => {
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(values), gl.STATIC_DRAW);
    const location = gl.getAttribLocation(program, name);
    gl.enableVertexAttribArray(location);
    gl.vertexAttribPointer(location, size, gl.FLOAT, false, 0, 0);
  };
  bindBuffer('aPosition', positions, 3);
  bindBuffer('aNormal', normals, 3);
  bindBuffer('aTone', tones, 1);
  const indexBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);

  const uProjection = gl.getUniformLocation(program, 'uProjection');
  const uView = gl.getUniformLocation(program, 'uView');
  const uModel = gl.getUniformLocation(program, 'uModel');

  const perspective = (fov, aspect, near, far) => {
    const f = 1 / Math.tan(fov / 2);
    const nf = 1 / (near - far);
    return new Float32Array([
      f / aspect, 0, 0, 0,
      0, f, 0, 0,
      0, 0, (far + near) * nf, -1,
      0, 0, 2 * far * near * nf, 0
    ]);
  };
  const modelMatrix = (ax, ay, az) => {
    const cx = Math.cos(ax), sx = Math.sin(ax);
    const cy = Math.cos(ay), sy = Math.sin(ay);
    const cz = Math.cos(az), sz = Math.sin(az);
    return new Float32Array([
      cy * cz, sx * sy * cz + cx * sz, -cx * sy * cz + sx * sz, 0,
      -cy * sz, -sx * sy * sz + cx * cz, cx * sy * sz + sx * cz, 0,
      sy, -sx * cy, cx * cy, 0,
      0, 0, 0, 1
    ]);
  };
  const view = new Float32Array([
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    0, 0, -4.7, 1
  ]);
  gl.uniformMatrix4fv(uView, false, view);
  gl.enable(gl.DEPTH_TEST);
  gl.enable(gl.CULL_FACE);
  gl.cullFace(gl.BACK);
  gl.clearColor(0, 0, 0, 0);

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const resize = () => {
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.max(1, Math.round(canvas.clientWidth * ratio));
    const height = Math.max(1, Math.round(canvas.clientHeight * ratio));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
      gl.viewport(0, 0, width, height);
      gl.uniformMatrix4fv(uProjection, false, perspective(Math.PI / 4.2, width / height, .1, 100));
    }
  };

  const started = performance.now();
  const render = (now) => {
    resize();
    const time = reducedMotion ? 0 : (now - started) / 1000;
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.uniformMatrix4fv(uModel, false, modelMatrix(-.22 + Math.sin(time * .24) * .025, .46 + time * .075, -.12));
    gl.drawElements(gl.TRIANGLES, indices.length, gl.UNSIGNED_SHORT, 0);
    if (!reducedMotion) requestAnimationFrame(render);
  };
  requestAnimationFrame(render);
})();
