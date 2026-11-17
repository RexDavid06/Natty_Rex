import tempfile
from pathlib import Path

from django.test import TestCase, override_settings


class MediaServingTests(TestCase):
    def test_uploaded_media_is_served_with_debug_off(self):
        with tempfile.TemporaryDirectory() as media_root:
            with override_settings(MEDIA_ROOT=media_root, DEBUG=False):
                file_path = Path(media_root) / "avatars" / "trainers" / "coach.png"
                file_path.parent.mkdir(parents=True)
                file_path.write_bytes(b"fake-image-bytes")

                response = self.client.get("/media/avatars/trainers/coach.png")
                self.assertEqual(response.status_code, 200)
                self.assertEqual(b"".join(response.streaming_content), b"fake-image-bytes")

    def test_missing_media_returns_404(self):
        with tempfile.TemporaryDirectory() as media_root:
            with override_settings(MEDIA_ROOT=media_root, DEBUG=False):
                response = self.client.get("/media/avatars/trainers/missing.png")
                self.assertEqual(response.status_code, 404)
