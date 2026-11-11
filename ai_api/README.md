# Robot Forge optional OpenAI CAD planner

Public UI: https://robot-forge-ui-preview.onrender.com/workspace/

This service is **disabled** unless two private environment variables are set in the Render Web Service dashboard:

- `OPENAI_API_KEY`: your own OpenAI Platform API key (never put this in the public Git repo or HTML)
- `AI_ACCESS_CODE`: a separately created, long random secret used to authorize requests to this prototype API
- Optional `OPENAI_MODEL`: an available OpenAI Responses model; default `gpt-5-mini`

Until configured, `GET /api/status` returns `enabled: false`, and `POST /api/plan` returns HTTP 503.

The public UI defaults to a deterministic **local CAD editor** even when server AI is unavailable.
Server AI outputs **only structured, bounded CAD parameters** that are revalidated in the browser.
It never runs arbitrary code or actuates robotics hardware.

Do not use a shared access code as production authentication. The basic in-memory rate limiter is only an abuse-reduction measure for the demonstration; scale-ready auth, quotas and billing are not included.

## Local development

```bash
pip install -r ai_api/requirements.txt
uvicorn ai_api.server:app --reload
```

The OpenAI Responses API integration uses the `text.format` JSON Schema feature and sets `store=false`.
No user request content is logged by this application code. Provider retention remains subject to the API service's own settings.
