import { useCallback, useLayoutEffect, useRef } from "react";
import type { ComponentProps, Ref } from "react";
import { initialAudio } from "../domain/playback";

type Props = Omit<ComponentProps<"video">, "muted" | "defaultMuted" | "ref"> & {
  /** Identidade do vídeo (não da URL assinada): quando muda, o mesmo elemento volta a começar mutado. */
  sourceKey: string;
  ref?: Ref<HTMLVideoElement>;
};

/**
 * <video> que sempre começa sem áudio. O mute é aplicado uma única vez, quando o elemento é criado
 * ou quando `sourceKey` muda; renderizações e renovações de URL não reativam o mute, então a escolha
 * do usuário nos controles do player é preservada.
 */
export function MutedVideo({ sourceKey, ref, ...props }: Props) {
  const element = useRef<HTMLVideoElement | null>(null);
  const outer = useRef(ref);
  outer.current = ref;
  const attach = useCallback((node: HTMLVideoElement | null) => {
    element.current = node;
    if (node) {
      node.defaultMuted = initialAudio.muted;
      node.muted = initialAudio.muted;
    }
    const target = outer.current;
    if (typeof target === "function") target(node);
    else if (target) target.current = node;
  }, []);
  const lastKey = useRef(sourceKey);
  useLayoutEffect(() => {
    if (lastKey.current === sourceKey) return;
    lastKey.current = sourceKey;
    if (element.current) element.current.muted = initialAudio.muted;
  }, [sourceKey]);
  return <video ref={attach} {...props} />;
}
