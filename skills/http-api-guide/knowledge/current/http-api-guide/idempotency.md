---
title: Idempotency
description: Idempotency keys so a retried POST does not create a second resource.
keywords: idempotency, retry, post
---

# Idempotency

Accept an idempotency key on POST. Store the first response and replay it when the same key arrives again. Expire keys on a window you document.
