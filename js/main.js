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

  // 내부 링크 클릭 시 2번 (Slide & Rise) 전환 효과
  const links = document.querySelectorAll("a[href]");

  links.forEach((link) => {
    link.addEventListener("click", (e) => {
      const href = link.getAttribute("href");
      const target = link.getAttribute("target");

      // 새 탭, 앵커 링크(#), 외부 링크, 자바스크립트 스킴 제외
      if (
        target === "_blank" ||
        !href ||
        href.startsWith("#") ||
        href.startsWith("javascript:") ||
        href.startsWith("http://") ||
        href.startsWith("https://") ||
        href.startsWith("mailto:")
      ) {
        return;
      }

      // 현재 페이지와 동일한 링크를 누른 경우 중복 이동 방지
      const currentFile = currentPath.split("/").pop() || "index.html";
      if (href === currentFile) {
        e.preventDefault();
        return;
      }

      // 2번 퇴장 모션: 클릭 즉시 180ms 만에 신속 이동
      e.preventDefault();
      document.body.classList.add("page-slide-exit");

      setTimeout(() => {
        window.location.href = href;
      }, 180);

    });
  });

  // 브라우저 뒤로가기(bfcache) 복귀 시 화면 복원
  window.addEventListener("pageshow", (event) => {
    if (event.persisted || document.body.classList.contains("page-slide-exit")) {
      document.body.classList.remove("page-slide-exit");
    }
  });
});


