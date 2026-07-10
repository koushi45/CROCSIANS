# CROCSIANS

CROCSIANS単体版です。

## Dockerで起動

```powershell
docker compose up --build
```

- ゲーム: http://localhost:3100
- PostgreSQL: localhost:16432
- 新規登録: `ユーザー名`、`ユーザーパスワード`、`サーバー共通パスワード`を入力

サーバー共通パスワードは `SERVER_SHARED_PASSWORD`で変更できます。初期値は `newbalance`です。
