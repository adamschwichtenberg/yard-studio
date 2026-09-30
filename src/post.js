import * as THREE from 'three';
import {
  BloomEffect,
  EffectComposer,
  EffectPass,
  KernelSize,
  RenderPass,
  SMAAEffect,
  SMAAPreset,
  TiltShiftEffect,
  ToneMappingEffect,
  ToneMappingMode,
  VignetteEffect,
} from 'postprocessing';
import { N8AOPostPass } from 'n8ao';

/**
 * RenderPass → N8AO → bloom → tilt-shift → AgX tone mapping + vignette → SMAA.
 *
 * Half-float buffers throughout; the renderer does no tone mapping. AgX
 * (the filmic curve Blender uses) keeps bright foliage and sunlit walls from
 * clipping to flat yellow. Bloom only catches true HDR highlights (the sun
 * orb, its path). Tilt-shift is for the diorama stage: a gentle blur top and
 * bottom that makes the model read as a model.
 */
export function createPost(renderer, scene, camera) {
  const size = renderer.getSize(new THREE.Vector2());
  const composer = new EffectComposer(renderer, { frameBufferType: THREE.HalfFloatType });
  const renderPass = new RenderPass(scene, camera);
  composer.addPass(renderPass);

  const ao = new N8AOPostPass(scene, camera, size.x, size.y);
  // Scene units are feet.
  ao.configuration.aoRadius = 4;
  ao.configuration.distanceFalloff = 1.0;
  ao.configuration.intensity = 1.6;
  ao.configuration.color = new THREE.Color(0x0a0f05);
  ao.setQualityMode('Medium');
  composer.addPass(ao);

  const bloom = new BloomEffect({ luminanceThreshold: 1.1, luminanceSmoothing: 0.3, intensity: 0.55, mipmapBlur: true, radius: 0.7 });
  const bloomPass = new EffectPass(camera, bloom);
  const tilt = new TiltShiftEffect({ offset: 0.02, focusArea: 0.72, feather: 0.3, kernelSize: KernelSize.MEDIUM, resolutionScale: 0.5 });
  const tiltPass = new EffectPass(camera, tilt);
  const tone = new ToneMappingEffect({ mode: ToneMappingMode.AGX });
  const vignette = new VignetteEffect({ offset: 0.32, darkness: 0.42 });
  const tonePass = new EffectPass(camera, tone, vignette);
  const smaaPass = new EffectPass(camera, new SMAAEffect({ preset: SMAAPreset.HIGH }));
  composer.addPass(bloomPass);
  composer.addPass(tiltPass);
  composer.addPass(tonePass);
  composer.addPass(smaaPass);

  let current = camera;
  const passes = [renderPass, bloomPass, tiltPass, tonePass, smaaPass];
  return {
    composer,
    ao,
    tone,
    /** Switches between the perspective and plan (orthographic) cameras. */
    setCamera(cam) {
      if (cam === current) return;
      current = cam;
      for (const p of passes) p.mainCamera = cam;
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
    /** Diorama look: tilt-shift and a stronger vignette. */
    setStage(diorama, planView) {
      tiltPass.enabled = !!diorama && !planView;
      vignette.darkness = diorama ? 0.5 : 0.28;
    },
    setBloom(on) {
      bloomPass.enabled = !!on;
    },
    render(dt) {
      composer.render(dt);
    },
  };
}
