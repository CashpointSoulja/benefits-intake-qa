import React from 'react';
import {Composition} from 'remotion';
import {Demo, TOTAL} from './Demo';
import {Vertical, VERTICAL_FRAMES} from './Vertical';
export const Root: React.FC = () => (
  <>
    <Composition id="Demo" component={Demo} durationInFrames={TOTAL} fps={30} width={1920} height={1080} />
    <Composition id="Vertical" component={Vertical} durationInFrames={VERTICAL_FRAMES} fps={30} width={1080} height={1920} />
  </>
);
