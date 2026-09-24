import * as THREE from 'three';
import {
  EffectComposer,
  EffectPass,
  RenderPass,
  SMAAEffect,
  SMAAPreset,
  ToneMappingEffect,
  ToneMappingMode,
} from 'postprocessing';
import { N8AOPostPass } from 'n8ao';

/**
 * RenderPass → N8AO → ACES tone mapping → SMAA.
 *
 * The renderer itself does no tone mapping and the composer works in half-float
 * buffers; tone mapping happens once, at the end. Hardware MSAA is off because
 * it doesn't combine with SSAO; SMAA handles edges instead.
 */
export function createPost(renderer, scene, camera) {
  const size = renderer.getSize(new THREE.Vector2());
  const composer = new EffectComposer(renderer, { frameBufferType: THREE.HalfFloatType });
  const renderPass = new RenderPass(scene, camera);
  composer.addPass(renderPass);

  const ao = new N8AOPostPass(scene, camera, size.x, size.y);
  // Scene units are feet.
  ao.configuration.aoRadius = 5;
  ao.configuration.distanceFalloff = 1.0;
  ao.configuration.intensity = 2.2;
  ao.configuration.color = new THREE.Color(0x0a0f05);
  ao.setQualityMode('Medium');
  composer.addPass(ao);

  const tonePass = new EffectPass(camera, new ToneMappingEffect({ mode: ToneMappingMode.ACES_FILMIC }));
  const smaaPass = new EffectPass(camera, new SMAAEffect({ preset: SMAAPreset.HIGH }));
  composer.addPass(tonePass);
  composer.addPass(smaaPass);

  let current = camera;
  return {
    composer,
    ao,
    /** Switches between the perspective and plan (orthographic) cameras. */
    setCamera(cam) {
      if (cam === current) return;
      current = cam;
      renderPass.mainCamera = cam;
      tonePass.mainCamera = cam;
      smaaPass.mainCamera = cam;
      ao.camera = cam;
      const ortho = !!cam.isOrthographicCamera;
      const depthType = ao.configuration.depthBufferType;
      ao.configureAOPass(depthType, ortho);
      ao.configureDenoisePass(depthType, ortho);
      ao.configureEffectCompositer(depthType, ortho);
    },
    setSize(w, h) {
      composer.setSize(w, h);
    },
    setAO(enabled) {
      ao.enabled = enabled;
    },
    render(dt) {
      composer.render(dt);
    },
  };
}
