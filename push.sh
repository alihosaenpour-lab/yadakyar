#!/usr/bin/env bash
# ارسال یدک‌یار به گیت‌هاب — توکن هیچ‌جا ذخیره نمی‌شود
#
#   chmod +x push.sh
#   ./push.sh <نام-کاربری-گیت‌هاب> [نام-مخزن]
#
# توکن کلاسیک را هنگام اجرا وارد می‌کنید (روی صفحه نمایش داده نمی‌شود).

set -euo pipefail

USER_NAME="${1:-}"
REPO="${2:-yadakyar}"

if [ -z "$USER_NAME" ]; then
  echo "استفاده: ./push.sh <نام-کاربری-گیت‌هاب> [نام-مخزن]"
  exit 1
fi

if [ -n "${GH_TOKEN:-}" ]; then
  TOKEN="$GH_TOKEN"
else
  read -rsp "توکن کلاسیک گیت‌هاب را بچسبانید (نمایش داده نمی‌شود): " TOKEN
  echo
fi

if [ -z "$TOKEN" ]; then echo "توکن خالی است."; exit 1; fi

cd "$(dirname "$0")"

# ۱) اگر مخزن وجود ندارد، ساخته شود
echo "⟳ بررسی مخزن $USER_NAME/$REPO ..."
CODE=$(curl -s -o /dev/null -w '%{http_code}' \
  -H "Authorization: token $TOKEN" \
  "https://api.github.com/repos/$USER_NAME/$REPO")

if [ "$CODE" = "404" ]; then
  echo "⟳ مخزن وجود ندارد؛ در حال ساخت ..."
  curl -s -o /dev/null -w 'وضعیت ساخت: %{http_code}\n' \
    -X POST -H "Authorization: token $TOKEN" \
    -H "Accept: application/vnd.github+json" \
    -d "{\"name\":\"$REPO\",\"description\":\"یدک‌یار — پلتفرم جامع قطعات خودرو\",\"private\":false,\"has_issues\":true}" \
    https://api.github.com/user/repos
elif [ "$CODE" = "401" ]; then
  echo "✗ توکن نامعتبر است یا منقضی شده."; exit 1
else
  echo "✓ مخزن موجود است (کد $CODE)"
fi

# ۲) ارسال — توکن فقط داخل همین دستور، نه در config
git remote remove origin 2>/dev/null || true
git remote add origin "https://github.com/$USER_NAME/$REPO.git"
git push "https://$USER_NAME:$TOKEN@github.com/$USER_NAME/$REPO.git" main:main --force-with-lease || \
git push "https://$USER_NAME:$TOKEN@github.com/$USER_NAME/$REPO.git" main:main

# ۳) فعال‌سازی GitHub Pages با منبع Actions
echo "⟳ فعال‌سازی GitHub Pages ..."
curl -s -o /dev/null -w 'وضعیت Pages: %{http_code}\n' \
  -X POST -H "Authorization: token $TOKEN" \
  -H "Accept: application/vnd.github+json" \
  -d '{"build_type":"workflow"}' \
  "https://api.github.com/repos/$USER_NAME/$REPO/pages" || true

unset TOKEN
echo
echo "✓ تمام."
echo "  مخزن : https://github.com/$USER_NAME/$REPO"
echo "  سایت : https://$USER_NAME.github.io/$REPO/   (چند دقیقه بعد از پایان Actions)"
