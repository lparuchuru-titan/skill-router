---
title: HTTP status codes
description: Which status code to return for a missing resource, a bad request, and a conflict.
keywords: status code, 404, 400, 409, missing resource
---

# HTTP status codes

Use 404 when the resource is missing, 400 when the request is malformed, and 409 when the request conflicts with current state. Do not use 200 with an error string in the body.
