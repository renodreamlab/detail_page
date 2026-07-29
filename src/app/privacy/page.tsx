import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";

export const metadata: Metadata = { title: "개인정보처리방침 | RENOABLE Detail Page Maker" };

export default function PrivacyPage() {
  return (
    <LegalPage title="개인정보처리방침" updated="2026-07-29">
      <section>
        <h2>1. 수집하는 개인정보 항목</h2>
        <ul>
          <li>Google 로그인 시: 이메일 주소, 이름, 프로필 사진(구글 기본 제공 범위)</li>
          <li>서비스 이용 시: 업로드한 이미지·PDF, 생성된 결과 이미지, 저장한 프로젝트 정보</li>
          <li>이용자가 입력한 외부 API 키는 이용자의 브라우저에만 보관되며, 생성 요청 처리 시에만 전송되고 서버에 저장되지 않습니다.</li>
        </ul>
      </section>
      <section>
        <h2>2. 수집·이용 목적</h2>
        <ul>
          <li>로그인 및 이용자 식별, 클라우드 저장 기능 제공</li>
          <li>서비스 운영·관리 및 오류 대응</li>
        </ul>
      </section>
      <section>
        <h2>3. 보유 및 파기</h2>
        <ul>
          <li>클라우드에 저장된 프로젝트는 이용자가 서비스 내에서 삭제하기 전까지 보관되며, 삭제 시 지체 없이 파기됩니다.</li>
          <li>생성에 사용한 업로드 원본은 생성 처리 직후 서버에서 삭제됩니다.</li>
          <li>계정 정보는 이용자의 삭제 요청 시 지체 없이 파기합니다. (문의처로 요청)</li>
        </ul>
      </section>
      <section>
        <h2>4. 처리 위탁 및 국외 이전</h2>
        <p>서비스 운영을 위해 아래 외부 서비스에 처리를 위탁하며, 이 과정에서 데이터가 국외로 이전될 수 있습니다.</p>
        <ul>
          <li>Supabase Inc.(미국) — 데이터베이스·인증·파일 저장 (서버 리전: 대한민국 서울)</li>
          <li>Vercel Inc.(미국) — 웹 호스팅 및 요청 처리</li>
          <li>OpenAI, L.L.C.(미국) / Google LLC(미국) — 이용자가 요청한 이미지 분석·생성 처리 (이용자 본인의 API 키로 전송)</li>
        </ul>
      </section>
      <section>
        <h2>5. 이용자의 권리</h2>
        <ul>
          <li>이용자는 언제든지 본인의 저장 프로젝트를 서비스 내에서 직접 삭제할 수 있습니다.</li>
          <li>계정 및 개인정보의 열람·정정·삭제는 문의처를 통해 요청할 수 있습니다.</li>
        </ul>
      </section>
      <section>
        <h2>6. 개인정보 보호책임자 및 문의</h2>
        <p>RENOABLE · [운영자 연락처 이메일을 입력하세요]</p>
      </section>
      <section>
        <h2>7. 고지</h2>
        <p>이 방침은 2026-07-29부터 적용되며, 내용 변경 시 서비스 내 공지로 알립니다.</p>
      </section>
    </LegalPage>
  );
}
