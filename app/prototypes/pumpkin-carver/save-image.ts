// Hand a PNG to the user: the share sheet on touch devices (so it can go to Photos),
// otherwise a plain download.

const FILE_NAME = "jack-o-lantern.png";

function download(blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = FILE_NAME;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/** Resolves true if the image was shared or downloaded, false if the user cancelled. */
export async function saveImage(blob: Blob): Promise<boolean> {
  const file = new File([blob], FILE_NAME, { type: "image/png" });
  const touch = window.matchMedia("(pointer: coarse)").matches;
  if (touch && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: "Jack-o'-lantern" });
      return true;
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return false;
      // Share refused (e.g. the gesture expired while rendering): fall back to download.
    }
  }
  download(blob);
  return true;
}
