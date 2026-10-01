const STORAGE_PREFIX = 'content-handler:calendar-image:v1:';
const IMAGE_BASE = 'https://impishlycreative.github.io/calendar_manager/kcw-calendar-site/';

const TYPES = Object.freeze({
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp'
});

export function safeImageUrl(value) {
  if (!value) return '';

  if (/^images\/[A-Za-z0-9_-]+\.(jpg|png|webp)$/.test(value)) {
    return new URL(value, IMAGE_BASE).href;
  }

  if (/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(value)) {
    return value;
  }

  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? url.href : '';
  } catch {
    return '';
  }
}

function newFilename(extension) {
  const random = crypto.getRandomValues(new Uint32Array(1))[0];
  return `event_${Date.now()}${random}.${extension}`;
}

export function createImageEditor({ root, userId, api }) {
  const file = root.querySelector('#calendarImageFile');
  const choose = root.querySelector('#calendarChooseImage');
  const selection = root.querySelector('#calendarImageSelection');
  const filename = root.querySelector('#calendarImageFilename');
  const alt = root.querySelector('#calendarImageAlt');
  const thumbnail = root.querySelector('#calendarImageThumbnail');
  const notice = root.querySelector('#calendarImageNotice');
  const discard = root.querySelector('#calendarDiscardImage');

  let key = '';
  let pending = null;
  let existing = {};
  let generation = 0;
  let reading = false;

  const message = text => {
    notice.textContent = text || '';
  };

  const persist = value => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      throw new Error(
        'This image could not be stored in your browser. Free some browser storage or choose a smaller image.'
      );
    }
  };

  const draw = () => {
    const src = safeImageUrl(pending?.dataUrl || existing.image);

    if (src) thumbnail.src = src;
    else thumbnail.removeAttribute('src');

    thumbnail.hidden = !src;
    thumbnail.alt = alt.value;
    filename.value =
      pending?.filename ||
      existing.imageFilename ||
      (src ? new URL(src, document.baseURI).pathname.split('/').pop() : '');

    selection.textContent = pending
      ? `Selected image: ${pending.originalName || pending.filename} (stored in this browser)`
      : src
        ? `Saved image: ${filename.value}`
        : 'No image selected.';

    choose.textContent = src ? 'Replace image' : 'Choose image';
    discard.hidden = !pending;

    message(
      pending
        ? 'Image kept in this browser. It will upload to GitHub when you save as draft or publish.'
        : 'Choose a JPEG, PNG, or WebP image up to 2 MB.'
    );
  };

  choose.addEventListener('click', () => file.click());

  file.addEventListener('change', async () => {
    const selected = file.files?.[0];
    if (!selected) return;

    const version = ++generation;
    reading = true;

    try {
      if (!TYPES[selected.type] || selected.size > 2 * 1024 * 1024) {
        throw new Error('Choose a JPEG, PNG, or WebP image no larger than 2 MB.');
      }

      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('The image could not be read.'));
        reader.readAsDataURL(selected);
      });

      const image = new Image();
      image.src = dataUrl;
      await image.decode();

      if (version !== generation) return;

      const generatedName = newFilename(TYPES[selected.type]);
      const next = {
        dataUrl,
        filename: generatedName,
        originalName: selected.name,
        imageAlt: alt.value,
        mimeType: selected.type
      };

      persist(next);
      pending = next;
      draw();
    } catch (error) {
      if (version === generation) {
        message(error?.message || 'This image cannot be opened. Choose another image.');
      }
    } finally {
      if (version === generation) {
        reading = false;
        file.value = '';
      }
    }
  });

  alt.addEventListener('input', () => {
    thumbnail.alt = alt.value;

    if (!pending) return;

    try {
      const next = { ...pending, imageAlt: alt.value };
      persist(next);
      pending = next;
    } catch (error) {
      message(error?.message);
    }
  });

  discard.addEventListener('click', () => {
    try {
      localStorage.removeItem(key);
    } catch {
      message('The pending image could not be removed from browser storage.');
      return;
    }

    generation += 1;
    reading = false;
    pending = null;
    alt.value = existing.imageAlt || '';
    draw();
  });

  return {
    open(event) {
      generation += 1;
      reading = false;
      existing = event || {};
      key =
        STORAGE_PREFIX +
        encodeURIComponent(userId || 'unknown') +
        ':' +
        encodeURIComponent(event?.id || 'new');
      pending = null;

      let restoreError = '';

      try {
        const saved = JSON.parse(localStorage.getItem(key) || 'null');

        if (
          saved &&
          TYPES[saved.mimeType] &&
          safeImageUrl(saved.dataUrl).startsWith('data:')
        ) {
          pending = saved;

          if (!/^event_[0-9]+\.(jpg|png|webp)$/.test(pending.filename)) {
            pending = {
              ...pending,
              filename: newFilename(TYPES[pending.mimeType])
            };
            persist(pending);
          }
        }
      } catch {
        restoreError =
          'Browser storage is unavailable or the saved image could not be restored.';
      }

      file.value = '';
      alt.value = pending?.imageAlt || existing.imageAlt || '';
      draw();

      if (restoreError) message(restoreError);
    },

    preview() {
      return {
        image: pending?.dataUrl || existing.image || '',
        imageAlt: alt.value
      };
    },

    async forSave() {
      if (reading) {
        throw new Error('Please wait for the image to finish loading.');
      }

      if ((pending || existing.image) && !alt.value.trim()) {
        throw new Error('Add an image description before saving.');
      }

      if (pending) {
        let result;

        for (let attempt = 0; attempt < 3; attempt += 1) {
          try {
            result = await api('uploadEventImage', {
              filename: pending.filename,
              mimeType: pending.mimeType,
              content: pending.dataUrl.split(',')[1]
            });
            break;
          } catch (error) {
            if (error?.code !== 'IMAGE_NAME_CONFLICT' || attempt === 2) {
              throw error;
            }

            const next = {
              ...pending,
              filename: newFilename(TYPES[pending.mimeType])
            };
            persist(next);
            pending = next;
            filename.value = next.filename;
          }
        }

        const address = safeImageUrl(result?.image);

        if (!address || address.startsWith('data:')) {
          throw new Error(
            'The upload did not return an image address. Your image is still stored in this browser.'
          );
        }

        return {
          image: result.image,
          imageFilename: pending.filename,
          imageAlt: alt.value.trim()
        };
      }

      return {
        image: existing.image || '',
        imageFilename: filename.value,
        imageAlt: alt.value.trim()
      };
    },

    saved() {
      try {
        localStorage.removeItem(key);
        pending = null;
        return true;
      } catch {
        return false;
      }
    }
  };
}
