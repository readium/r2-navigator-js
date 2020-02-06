// ==LICENSE-BEGIN==
// Copyright 2017 European Digital Reading Lab. All rights reserved.
// Licensed to the Readium Foundation under one or more contributor license agreements.
// Use of this source code is governed by a BSD-style license
// that can be found in the LICENSE file exposed on Github (readium) in the project repository.
// ==LICENSE-END==

export interface IAudioPlaybackInfo {
    globalDuration: number | undefined;
    globalProgression: number | undefined;
    globalTime: number | undefined;
    isPlaying: boolean | undefined;
    localDuration: number | undefined;
    localProgression: number | undefined;
    localTime: number | undefined;
}
