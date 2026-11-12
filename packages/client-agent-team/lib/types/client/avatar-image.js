import { useState } from 'react';
/**
 * Whether one avatar URL actually draws. The Host accepts an avatar by declared media type only, so undecodable bytes (HEIC,
 * damaged payloads) come back as a data URL that renders nothing; testing for `undefined` cannot tell that from a picture.
 * The record is keyed by URL, so a new upload retries on its own.
 */
export function useAvatarImage(url) {
    const [broken, setBroken] = useState(undefined);
    return {
        image: url === undefined || url === broken ? { kind: 'initial' } : { kind: 'image', src: url },
        failed: () => { if (url !== undefined)
            setBroken(url); },
    };
}
