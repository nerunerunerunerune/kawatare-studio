// Cloudflare Pages Functions ミドルウェア
//
// なぜ必要か：
// Pages プロジェクトには本番のカスタムドメインとは別に <project>.pages.dev が
// 必ず割り当てられ、無効化できない。放っておくと同じ内容が2つのURLで公開され、
// 重複コンテンツになるうえ、GA4のアクセス数も二重に計上される。
// 実際 2026年8月7日時点で、こでっとの26PVのうち16PVが pages.dev からだった。
//
// 何をするか：
// 本番の pages.dev ホストに来たリクエストだけを、カスタムドメインへ301で送る。
// パスとクエリはそのまま引き継ぐ。
//
// 何をしないか：
// プレビューデプロイ（<ハッシュ>.kawatare-studio.pages.dev の形）は**素通しする**。
// ここを厳密一致にしないと、ブランチのプレビュー確認ができなくなる。
//
// 安全策：
// 例外が出ても必ず context.next() に落ちる。リダイレクトの失敗でサイトを
// 落とさないことを最優先にしている。

const PAGES_HOST = 'kawatare-studio.pages.dev';
const CANONICAL_HOST = 'kawatare.studio';

export async function onRequest(context) {
  try {
    const url = new URL(context.request.url);
    if (url.hostname === PAGES_HOST) {
      url.protocol = 'https:';
      url.hostname = CANONICAL_HOST;
      url.port = '';
      return Response.redirect(url.toString(), 301);
    }
  } catch (e) {
    // 判定に失敗したら何もせず通常配信へ落とす
  }
  return context.next();
}
