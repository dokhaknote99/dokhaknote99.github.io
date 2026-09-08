// main.js - 포트폴리오 공통 자바스크립트

document.addEventListener("DOMContentLoaded", () => {
  console.log("포트폴리오 페이지가 정상적으로 로드되었습니다.");

  // 현재 활성 페이지 탭 강조 보조 로직 (필요 시 자동 감지)
  const currentPath = window.location.pathname;
  const navLinks = document.querySelectorAll(".tab-item a");

  navLinks.forEach((link) => {
    const href = link.getAttribute("href");
    if (currentPath.endsWith(href) || (currentPath.endsWith("/") && href === "index.html")) {
      link.classList.add("active");
    }
  });
});
