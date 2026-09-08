// main.js - 포트폴리오 공통 자바스크립트

// ==========================================================================
// [설정] 배경 동영상 루프(반복) 구간 설정 (초 단위로 자유롭게 수정하세요)
// ==========================================================================
const VIDEO_LOOP = {
  startTime: 0.0, // 루프 시작 지점 (초 단위, 기본: 0초)
  endTime: 5.5,   // 👈 루프 종료 지점 (초 단위, 이 시간에 도달하면 즉시 시작 지점으로 이동)
  enabled: true   // 커스텀 루프 사용 여부 (true: 사용, false: 영상 끝까지 재생 후 반복)
};

document.addEventListener("DOMContentLoaded", () => {
  console.log("포트폴리오 페이지가 정상적으로 로드되었습니다.");

  // 배경 동영상 특정 시간 루프 제어
  const bgVideo = document.getElementById("bgVideo");
  if (bgVideo && VIDEO_LOOP.enabled && VIDEO_LOOP.endTime > 0) {
    // 매 프레임 정밀하게 재생 시간을 감시하여 오차 없이 즉시 되감기
    const monitorVideoLoop = () => {
      if (bgVideo.currentTime >= VIDEO_LOOP.endTime) {
        bgVideo.currentTime = VIDEO_LOOP.startTime;
        bgVideo.play();
      }
      requestAnimationFrame(monitorVideoLoop);
    };

    bgVideo.addEventListener("loadedmetadata", () => {
      bgVideo.currentTime = VIDEO_LOOP.startTime;
      requestAnimationFrame(monitorVideoLoop);
    });

    if (bgVideo.readyState >= 1) {
      bgVideo.currentTime = VIDEO_LOOP.startTime;
      requestAnimationFrame(monitorVideoLoop);
    }
  }


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

      // 페이드아웃 전환 적용 후 200ms 뒤 이동
      e.preventDefault();
      document.body.classList.add("page-fade-exit");

      setTimeout(() => {
        window.location.href = href;
      }, 200);

    });
  });

  // 브라우저 뒤로가기(bfcache) 복귀 시 화면 복원
  window.addEventListener("pageshow", (event) => {
    if (event.persisted || document.body.classList.contains("page-fade-exit")) {
      document.body.classList.remove("page-fade-exit");
    }
  });
});



