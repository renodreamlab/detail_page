import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";

export const metadata: Metadata = { title: "이용약관 | RENOABLE Detail Page Maker" };

export default function TermsPage() {
  return (
    <LegalPage title="이용약관" updated="2026-07-29">
      <section>
        <h2>제1조 (목적)</h2>
        <p>
          이 약관은 운영자가 제공하는 서비스 &ldquo;RENOABLE Detail Page Maker&rdquo;(이하 &ldquo;서비스&rdquo;)의 이용 조건과
          절차, 이용자와 운영자의 권리·의무를 정하는 것을 목적으로 합니다.
        </p>
      </section>
      <section>
        <h2>제2조 (서비스의 성격)</h2>
        <ul>
          <li>본 서비스는 기존 상세페이지 이미지를 분석해 구매전환 중심으로 리디자인하는 이미지 제작 도구입니다.</li>
          <li>서비스의 기능·저장 정책·제공 여부는 사전 고지 없이 변경되거나 중단될 수 있습니다.</li>
          <li>운영자는 서비스의 지속성, 무결성, 특정 목적 적합성을 보증하지 않습니다.</li>
        </ul>
      </section>
      <section>
        <h2>제3조 (이용 계약 및 계정)</h2>
        <ul>
          <li>서비스는 Google 계정 로그인으로 이용할 수 있으며, 로그인 시 이 약관과 개인정보처리방침에 동의한 것으로 봅니다.</li>
          <li>계정 관리 책임은 이용자에게 있으며, 타인의 계정을 무단으로 사용해서는 안 됩니다.</li>
        </ul>
      </section>
      <section>
        <h2>제4조 (API 키와 생성 비용)</h2>
        <ul>
          <li>이미지 생성에는 이용자 본인의 OpenAI 또는 Google 등 외부 API 키가 필요하며, 해당 API 사용 요금은 이용자 본인이 부담합니다.</li>
          <li>API 키는 이용자의 브라우저에만 보관되고 생성 요청 처리 시에만 전송되며, 운영자는 이를 서버에 저장하지 않습니다.</li>
        </ul>
      </section>
      <section>
        <h2>제5조 (데이터 저장 정책)</h2>
        <ul>
          <li>비로그인 상태에서는 작업이 이용자의 브라우저(기기)에만 저장됩니다.</li>
          <li>로그인 시 작업을 클라우드에 저장하고 기기 간에 불러올 수 있으며, 이용자는 저장한 작업을 언제든지 직접 삭제할 수 있습니다.</li>
          <li>생성에 사용한 업로드 원본은 생성 처리 직후 서버에서 삭제됩니다.</li>
          <li>중요한 결과물은 다운로드 기능으로 이용자 기기에 보관하시기 바랍니다.</li>
        </ul>
      </section>
      <section>
        <h2>제6조 (콘텐츠의 권리와 책임)</h2>
        <ul>
          <li>이용자가 업로드한 이미지에 대한 권리와 책임은 이용자에게 있습니다. 타인의 권리를 침해하는 자료를 업로드해서는 안 됩니다.</li>
          <li>생성된 결과물의 사용 책임은 이용자에게 있으며, AI 생성물의 대외 사용 시 관련 법령에 따른 표시 의무는 이용자가 준수해야 합니다.</li>
        </ul>
      </section>
      <section>
        <h2>제7조 (금지 행위)</h2>
        <ul>
          <li>불법·음란·혐오·타인 권리 침해 콘텐츠의 생성 또는 업로드</li>
          <li>서비스의 정상 운영을 방해하는 자동화된 대량 요청</li>
          <li>서비스를 무단으로 상업적 재판매하는 행위</li>
        </ul>
      </section>
      <section>
        <h2>제8조 (책임의 제한)</h2>
        <p>
          운영자는 데이터 유실·서비스 중단·생성 결과의 품질 등으로 발생한 손해에 대해 관련 법령이 허용하는 범위에서 책임을
          지지 않습니다.
        </p>
      </section>
      <section>
        <h2>제9조 (문의)</h2>
        <p>서비스 관련 문의: [운영자 연락처 이메일을 입력하세요]</p>
      </section>
    </LegalPage>
  );
}
