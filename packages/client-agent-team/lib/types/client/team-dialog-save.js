import { useRef, useState } from 'react';
import { isUncertainRemoteFailure } from "./requests.js";
export function useEditDialogSave({ save, onCommitted, onClose }) {
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState();
    const pendingRequest = useRef();
    const submit = async (build) => {
        const request = build(pendingRequest.current);
        pendingRequest.current = request;
        setSaving(true);
        setError(undefined);
        try {
            const result = await save(request);
            if (result.ok) {
                pendingRequest.current = undefined;
                onClose();
                // The list owner catches and renders its refresh failure; it must not turn a confirmed write back into a form error.
                void onCommitted();
            }
            else {
                if (!isUncertainRemoteFailure(result.error))
                    pendingRequest.current = undefined;
                setError(result.error.message);
            }
        }
        catch (cause) {
            setError(cause instanceof Error ? cause.message : String(cause));
        }
        finally {
            setSaving(false);
        }
    };
    return {
        saving,
        error,
        save: submit,
        invalidate: () => { pendingRequest.current = undefined; },
    };
}
