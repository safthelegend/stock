## Delivery photo gallery

Photos here show up in the photo carousel under "Our Impact" on the home
page (`index.html#our-impact`): one photo in the middle, its neighbours
blurred to either side, moving on every 15 seconds. The carousel stays
hidden until it has at least one photo.

To add a photo:

1. Drop the image file in this folder (`assets/gallery/`). Keep it
   reasonably sized — a few hundred KB, not a multi-MB phone original — so
   the page stays fast. Resize/export at roughly 1600px on the long edge.
2. Open `assets/site.js`, find the `GALLERY` array (search for
   `DELIVERY PHOTO GALLERY`), and add a line:

   ```js
   { src: "assets/gallery/your-file.jpg", caption: "Short caption" },
   ```

3. Save and reload the home page. The caption is optional but recommended
   — it's also used as the photo's alt text.
