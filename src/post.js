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
 * The renderer itself does NO tone mapping and the composer works in half-float
 * buffers; tone mapping happens once, at the end. Hardware MSAA is off because
 * it doesn't combine with SSAO; SMAA handles edges instead.
 */
export function createPost(renderer, scene, camera) {
  const size = renderer.getSize(new THREE.Vector2());
  const composer = new EffectComposer(renderer, { frameBufferType: THREE.HalfFloatType });
  composer.addPass(new RenderPass(scene, camera));

  const ao = new N8AOPostPass(scene, camera, size.x, size.y);
  ao.configuration.aoRadius = 1.6;
  ao.configuration.distanceFalloff = 1.0;
  ao.configuration.intensity = 2.2;
  ao.configuration.color = new THREE.Color(0x0a0f05);
  ao.setQualityMode('Medium');
  composer.addPass(ao);

  const toneMapping = new ToneMappingEffect({ mode: ToneMappingMode.ACES_FILMIC });
  composer.addPass(new EffectPass(camera, toneMapping));
  composer.addPass(new EffectPass(camera, new SMAAEffect({ preset: SMAAPreset.HIGH })));

  return {
    composer,
    ao,
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
