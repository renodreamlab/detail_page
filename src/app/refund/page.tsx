import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";

export const metadata: Metadata = { title: "환불 정책 | RENOABLE Detail Page Maker" };

export default function RefundPage() {
  return (
    <LegalPage title="환불 정책" updated="2026-07-31">
      <section>
        <h2>제1조 (크레딧과 차감 기준)</h2>
        <ul>
          <li>크레딧은 이미지 생성·부분 편집·영상 제작에 사용되는 선불 이용권입니다.</li>
          <li>크레딧은 <strong>성공한 결과물에만</strong> 차감됩니다. 생성이 실패한 경우 차감되지 않습니다.</li>
          <li>소모 기준: 이미지 생성·부분 편집 1장 = 1크레딧, 모션 영상 1건 = 1크레딧, 홍보영상 720p = 8크레딧 / 1080p = 18크레딧.</li>
        </ul>
      </section>
      <section>
        <h2>제2조 (청약철회 및 환불)</h2>
        <ul>
          <li>충전한 크레딧을 <strong>전혀 사용하지 않은 경우</strong>, 결제일로부터 7일 이내 요청 시 전액 환불됩니다.</li>
          <li>크레딧을 일부 사용한 경우, 결제 금액에서 <strong>사용한 크레딧 × 해당 상품의 크레딧당 단가</strong>를 차감한 잔액을 환불합니다.</li>
          <li>무료로 지급된 크레딧(가입 보너스, 이벤트, 관리자 지급분)은 환불 대상이 아니며, 환불 계산 시 유료 충전분보다 먼저 사용된 것으로 봅니다.</li>
          <li>무통장 입금 결제는 입금 확인·승인 이후 동일한 기준이 적용됩니다.</li>
        </ul>
      </section>
      <section>
        <h2>제3조 (환불 방법과 처리 기한)</h2>
        <ul>
          <li>환불 요청은 결제 계정(이메일)으로 아래 문의처에 접수해 주세요. 주문번호 또는 결제 일시를 함께 알려주시면 빠르게 처리됩니다.</li>
          <li>카드 결제는 원 결제수단 취소로, 무통장 입금은 입금 계좌로 환불되며, 접수일로부터 영업일 기준 3~5일 이내 처리를 원칙으로 합니다.</li>
        </ul>
      </section>
      <section>
        <h2>제4조 (환불이 제한되는 경우)</h2>
        <ul>
          <li>이미 생성에 사용(차감)된 크레딧에 해당하는 금액</li>
          <li>약관 위반(금지 행위)으로 이용이 제한된 계정의 결제 건</li>
          <li>관련 법령에서 청약철회가 제한되는 경우</li>
        </ul>
      </section>
      <section>
        <h2>제5조 (문의)</h2>
        <p>환불 관련 문의: [운영자 연락처 이메일을 입력하세요]</p>
      </section>
    </LegalPage>
  );
}
