import {
  useCallback, useEffect, useMemo, useRef, useState,
} from 'react';
import { useDispatch } from 'react-redux';
import { useCurrentComponent, useCurrentIdentifier } from '../routes/utils';
import { useStoreDispatch, useStoreActions } from '../store/store';
import { ParticipantData, WebsiteComponent } from '../parser/types';
import { PREFIX as BASE_PREFIX } from '../utils/Prefix';

const PREFIX = '@REVISIT_COMMS';

const defaultStyle = {
  width: '100%',
  border: 0,
};

export function IframeController({ currentConfig, provState, answers }: { currentConfig: WebsiteComponent; provState?: unknown, answers: ParticipantData['answers'] }) {
  const {
    setReactiveAnswers, updateResponseBlockValidation,
  } = useStoreActions();
  const storeDispatch = useStoreDispatch();
  const dispatch = useDispatch();
  const identifier = useCurrentIdentifier();
  const [height, setHeight] = useState(800);

  const ref = useRef<HTMLIFrameElement>(null);

  const iframeId = useMemo(
    () => (crypto.randomUUID ? crypto.randomUUID() : `testID-${Date.now()}`),
    [],
  );

  // navigation
  const currentComponent = useCurrentComponent();

  const sendMessage = useCallback(
    (tag: string, message: unknown) => {
      ref.current?.contentWindow?.postMessage(
        {
          error: false,
          type: `${PREFIX}/${tag}`,
          iframeId,
          message,
        },
        '*',
      );
    },
    [ref, iframeId],
  );

  useEffect(() => {
    if (provState) {
      sendMessage('PROVENANCE', provState);
    }
  }, [provState, sendMessage]);

  useEffect(() => {
    if (answers) {
      sendMessage('ANSWERS', answers);
    }
  }, [answers, sendMessage]);

  useEffect(() => {
    const handler = (e: MessageEvent) => {
      const { data } = e;
      if (typeof data === 'object' && iframeId === data.iframeId) {
        switch (data.type) {
          case `${PREFIX}/WINDOW_READY`:
            if (currentConfig.parameters) {
              sendMessage('STUDY_DATA', currentConfig.parameters);
            }
            break;
          case `${PREFIX}/READY`:
            if (ref.current) {
              const iFrame = document.getElementById(data.iframeId) as HTMLIFrameElement;
              if (iFrame && iFrame.contentWindow) {
                ref.current.style.height = `${iFrame.contentWindow.document.body.scrollHeight.toString()}px`;
              }
            }
            break;
          case `${PREFIX}/ANSWERS`:
            storeDispatch(setReactiveAnswers(data.message));
            storeDispatch(updateResponseBlockValidation({
              location: 'stimulus',
              identifier,
              status: true,
              values: data.message,
            }));
            break;
          case `${PREFIX}/PROVENANCE`:
            storeDispatch(updateResponseBlockValidation({
              location: 'stimulus',
              identifier,
              values: {},
              status: true,
              provenanceGraph: data.message,
            }));
            break;
          default:
            break;
        }
      }
    };

    window.addEventListener('message', handler);

    return () => window.removeEventListener('message', handler);
  }, [storeDispatch, dispatch, iframeId, currentConfig, sendMessage, setReactiveAnswers, updateResponseBlockValidation, identifier]);

  return (
    <iframe
      ref={ref}
      id={iframeId}
      src={
        currentConfig.path.startsWith('http')
          ? currentConfig.path
          : `${BASE_PREFIX}${currentConfig.path}?trialid=${currentComponent}&id=${iframeId}`
      }
      style={{ ...defaultStyle, height }}
      onLoad={() => setHeight((ref.current?.contentWindow?.document.body.scrollHeight || 750) + 20)}
    />
  );
}
