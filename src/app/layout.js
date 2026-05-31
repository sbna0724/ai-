import "./globals.css";

export const metadata = {
  title: "AI 캐시가드",
  description: "결제 전 AI에게 물어보세요",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <head>
        {/* Noto Sans KR 폰트 추가 */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;700;900&display=swap" rel="stylesheet" />
        {/* Phosphor Icons 스크립트 추가 */}
        <script src="https://unpkg.com/@phosphor-icons/web" async></script>
      </head>
      <body>{children}</body>
    </html>
  );
}