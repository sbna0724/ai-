'use client'; // Next.js에서 상태 관리(useState)를 사용하기 위한 필수 선언

import { useState } from 'react';

export default function Home() {
    // API 키 설정 (이곳에 제미나이 API 키를 입력하세요)
    const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;

    // 화면 및 상태 관리
    const [screen, setScreen] = useState(1);
    const [budget, setBudget] = useState(500000);
    const [balance, setBalance] = useState(150000);
    const [inputMode, setInputMode] = useState('image'); // 'image' or 'text'
    
    // 입력 데이터 상태
    const [imagePreview, setImagePreview] = useState(null);
    const [imageBase64, setImageBase64] = useState("");
    const [itemName, setItemName] = useState("");
    const [itemPrice, setItemPrice] = useState("");

    // 로딩 및 에러, 결과 상태
    const [isLoading, setIsLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState("");
    const [result, setResult] = useState(null);

    // 다음 화면으로 넘어가며 초기화하는 함수
    const goToScreen = (screenNumber) => {
        if (screenNumber === 2) {
            setInputMode('image');
            setImagePreview(null);
            setImageBase64("");
            setItemName("");
            setItemPrice("");
            setErrorMsg("");
        }
        setScreen(screenNumber);
    };

    // 이미지 업로드 핸들러
    const handleImageUpload = (event) => {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            const dataUrl = e.target.result;
            setImagePreview(dataUrl);
            setImageBase64(dataUrl.split(',')[1]);
        };
        reader.readAsDataURL(file);
    };

    // 분석 버튼 활성화 조건 체크
    const isAnalyzeDisabled = inputMode === 'image' 
        ? !imageBase64 
        : !(itemName.trim() && itemPrice);

    // 지수 백오프 기반 API 호출 함수
    const fetchWithRetry = async (url, options, maxRetries = 5) => {
        const delays = [1000, 2000, 4000, 8000, 16000];
        for (let i = 0; i < maxRetries; i++) {
            try {
                const response = await fetch(url, options);
                if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                return await response.json();
            } catch (error) {
                if (i === maxRetries - 1) throw error;
                await new Promise(resolve => setTimeout(resolve, delays[i]));
            }
        }
    };

    // AI 분석 시작 함수
    const startAnalysis = async () => {
        if (isAnalyzeDisabled) return;
        if (!apiKey) {
            setErrorMsg("코드 상단에 제미나이 API 키를 먼저 입력해주세요!");
            return;
        }

        setErrorMsg("");
        setIsLoading(true);

        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${process.env.NEXT_PUBLIC_GEMINI_API_KEY}`;
        
        
        let requestContents = [];
        if (inputMode === 'image') {
            requestContents = [{
                "parts": [
                    { "text": `이번 달 남은 예산: ${budget}원, 현재 통장 잔고: ${balance}원. 내가 지금 사려는 물건의 이미지야. 살까 말까? 분석해줘.` },
                    { "inlineData": { "mimeType": "image/jpeg", "data": imageBase64 } }
                ]
            }];
        } else {
            requestContents = [{
                "parts": [
                    { "text": `이번 달 남은 예산: ${budget}원, 현재 통장 잔고: ${balance}원. 내가 사려는 물건은 '${itemName}' 이고, 가격은 ${itemPrice}원이야. 살까 말까? 분석해줘.` }
                ]
            }];
        }

        const payload = {
            "systemInstruction": {
                "parts": [{
                    "text": "너는 Z세대의 소비를 막아주는 매운맛 금융 코치 'AI 캐시가드'야. 유저가 사고싶은 물건의 정보(이미지 또는 텍스트)와 현재 잔고, 예산을 제공할 거야. 이미지가 있다면 분석해서 제품명과 가격을 추정해. 그리고 이 물건을 사면 안 되는 이유를 아주 직설적이고 유머러스하게 비판(Roast)해. 파산 위험도를 0~100 사이로 계산해. 마지막으로 더 저렴한 가성비 대안 상품 2개를 추천해. 반드시 지정된 JSON 스키마에 맞춰서 응답해."
                }]
            },
            "contents": requestContents,
            "generationConfig": {
                "responseMimeType": "application/json",
                "responseSchema": {
                    "type": "OBJECT",
                    "properties": {
                        "itemName": { "type": "STRING", "description": "이미지에서 인식하거나 추정한 제품명" },
                        "itemPrice": { "type": "INTEGER", "description": "이미지에서 인식하거나 추정한 가격 (숫자만)" },
                        "isApproved": { "type": "BOOLEAN", "description": "구매 승인 여부 (잔고가 넉넉하면 true, 쪼들리면 false)" },
                        "roastMessage": { "type": "STRING", "description": "유저의 낭비를 비판하는 뼈 때리는 팩트 폭행 한 줄 평 (반말/존댓말 혼용하여 유머러스하게)" },
                        "bankruptcyRisk": { "type": "INTEGER", "description": "0에서 100 사이의 결제 후 파산 위험도 확률" },
                        "alternatives": {
                            "type": "ARRAY",
                            "items": {
                                "type": "OBJECT",
                                "properties": {
                                    "name": { "type": "STRING", "description": "비슷한 종류의 훨씬 저렴한 가성비 대안 상품명 (브랜드 포함)" },
                                    "price": { "type": "INTEGER", "description": "대안 상품의 예상 가격 (숫자만)" }
                                }
                            }
                        }
                    },
                    "required": ["itemName", "itemPrice", "isApproved", "roastMessage", "bankruptcyRisk", "alternatives"]
                }
            }
        };

        try {
            const data = await fetchWithRetry(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const jsonText = data.candidates[0].content.parts[0].text;
            const parsedResult = JSON.parse(jsonText);
            
            setResult(parsedResult);
            setIsLoading(false);
            setScreen(3);
            
        } catch (error) {
            console.error("API Call Failed:", error);
            setIsLoading(false);
            setErrorMsg("앗, AI가 너무 많은 팩폭을 준비하다가 오류가 발생했습니다. 다시 시도해주세요.");
        }
    };

    return (
        <div className="text-gray-900 font-sans min-h-screen bg-gray-200">
            {/* 전역 스타일 설정 */}
            <style dangerouslySetInnerHTML={{__html: `
                body { font-family: 'Noto Sans KR', sans-serif; background-color: #e5e7eb; }
                .mobile-container { max-width: 400px; margin: 0 auto; background-color: #f9fafb; min-height: 100vh; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25); position: relative; overflow: hidden; }
                .risk-bar-fill { transition: width 1.5s cubic-bezier(0.4, 0, 0.2, 1); }
            `}} />

            <div className="mobile-container flex flex-col">
                {/* 헤더 */}
                <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-center sticky top-0 z-10">
                    <h1 className="text-xl font-black tracking-tighter text-gray-800">AI CashGuard.</h1>
                </header>

                {/* ================= Screen 1: 초기 설정 ================= */}
                {screen === 1 && (
                    <main className="flex-1 flex flex-col p-6 overflow-y-auto">
                        <div className="mb-8 mt-4">
                            <h2 className="text-2xl font-bold mb-2">현재 재정 상태를<br/>알려주세요.</h2>
                            <p className="text-gray-500 text-sm">AI가 정확한 팩트 폭행을 위해 잔고를 파악합니다.</p>
                        </div>

                        <div className="space-y-6">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2">이번 달 남은 생활비 예산</label>
                                <div className="relative">
                                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 font-bold text-gray-400">₩</span>
                                    <input 
                                        type="number" 
                                        className="w-full pl-8 pr-4 py-3 bg-white border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-800 font-bold" 
                                        value={budget}
                                        onChange={(e) => setBudget(Number(e.target.value))}
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2">현재 통장 실제 잔고</label>
                                <div className="relative">
                                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 font-bold text-gray-400">₩</span>
                                    <input 
                                        type="number" 
                                        className="w-full pl-8 pr-4 py-3 bg-white border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-800 font-bold" 
                                        value={balance}
                                        onChange={(e) => setBalance(Number(e.target.value))}
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="mt-auto pt-8">
                            <button onClick={() => goToScreen(2)} className="w-full bg-gray-900 text-white font-bold py-4 rounded-xl hover:bg-gray-800 active:scale-95 transition-transform flex justify-center items-center gap-2">
                                시작하기 <i className="ph ph-arrow-right font-bold"></i>
                            </button>
                        </div>
                    </main>
                )}

                {/* ================= Screen 2: 장바구니 캡처 ================= */}
                {screen === 2 && (
                    <main className="flex-1 flex flex-col p-6 overflow-y-auto">
                        <div className="mb-6 mt-4 flex items-center gap-2">
                            <button onClick={() => setScreen(1)} className="p-2 -ml-2 text-gray-500 hover:text-gray-900 rounded-full">
                                <i className="ph ph-caret-left text-xl"></i>
                            </button>
                            <h2 className="text-2xl font-bold">살까 말까 고민되나요?</h2>
                        </div>
                        <p className="text-gray-500 text-sm mb-6">사고 싶은 물건을 캡처해서 올리거나 직접 입력해주세요. AI가 결제를 허락할지 판단합니다.</p>

                        {/* 입력 방식 탭 */}
                        <div className="flex bg-gray-200 p-1 rounded-lg mb-6">
                            <button onClick={() => setInputMode('image')} className={`flex-1 py-2 text-sm font-bold rounded-md ${inputMode === 'image' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:bg-gray-300'}`}>캡처 업로드</button>
                            <button onClick={() => setInputMode('text')} className={`flex-1 py-2 text-sm font-bold rounded-md ${inputMode === 'text' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:bg-gray-300'}`}>직접 입력</button>
                        </div>

                        <div className="flex-1 flex flex-col items-center justify-center w-full">
                            {/* 이미지 영역 */}
                            {inputMode === 'image' && (
                                <div className="w-full">
                                    <label htmlFor="image-upload" className="w-full h-64 border-2 border-dashed border-gray-400 rounded-2xl flex flex-col items-center justify-center cursor-pointer hover:bg-gray-100 transition-colors bg-white relative overflow-hidden">
                                        {!imagePreview ? (
                                            <div className="flex flex-col items-center pointer-events-none">
                                                <i className="ph ph-image text-4xl text-gray-400 mb-2"></i>
                                                <span className="text-gray-500 font-medium">터치하여 캡처 이미지 업로드</span>
                                            </div>
                                        ) : (
                                            <img src={imagePreview} className="absolute inset-0 w-full h-full object-cover" alt="미리보기" />
                                        )}
                                        <input id="image-upload" type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                                    </label>
                                </div>
                            )}

                            {/* 텍스트 영역 */}
                            {inputMode === 'text' && (
                                <div className="w-full space-y-4">
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-2">상품명</label>
                                        <input type="text" placeholder="예: 나이키 에어포스 1" className="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-800 font-bold" value={itemName} onChange={(e) => setItemName(e.target.value)} />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-2">가격</label>
                                        <div className="relative">
                                            <span className="absolute inset-y-0 left-0 flex items-center pl-3 font-bold text-gray-400">₩</span>
                                            <input type="number" placeholder="예: 139000" className="w-full pl-8 pr-4 py-3 bg-white border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-800 font-bold" value={itemPrice} onChange={(e) => setItemPrice(e.target.value)} />
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {errorMsg && <div className="text-red-600 text-sm font-bold text-center mt-4">{errorMsg}</div>}

                        <div className="mt-8">
                            <button onClick={startAnalysis} disabled={isAnalyzeDisabled} className="w-full bg-gray-900 text-white font-bold py-4 rounded-xl hover:bg-gray-800 active:scale-95 transition-transform flex justify-center items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
                                AI 평가 받기 <i className="ph ph-magnifying-glass font-bold"></i>
                            </button>
                        </div>
                    </main>
                )}

                {/* ================= Screen 3: AI 분석 리포트 ================= */}
                {screen === 3 && result && (
                    <main className="flex-1 flex flex-col p-6 overflow-y-auto bg-gray-900 text-white">
                        <div className="flex justify-between items-center mb-8 mt-2">
                            <button onClick={() => setScreen(2)} className="text-gray-400 hover:text-white"><i className="ph ph-x text-2xl"></i></button>
                            <span className="text-xs font-bold px-3 py-1 bg-gray-800 rounded-full text-gray-300">AI Report</span>
                        </div>

                        <div className="text-center mb-8">
                            <div className="text-6xl mb-4">{result.isApproved ? "💸" : "🚫"}</div>
                            <h2 className={`text-3xl font-black mb-2 ${result.isApproved ? "text-green-400" : "text-red-500"}`}>
                                {result.isApproved ? "결제 승인" : "결제 거절"}
                            </h2>
                            <p className="text-gray-400 text-sm">{result.itemName} ({result.itemPrice.toLocaleString()}원)</p>
                        </div>

                        <div className="bg-gray-800 rounded-2xl p-5 mb-6 relative">
                            <div className="absolute -top-3 left-4 bg-gray-900 px-2 text-xs font-bold text-gray-400">AI의 팩폭 한 줄</div>
                            <p className="text-lg font-bold leading-relaxed">"{result.roastMessage}"</p>
                        </div>

                        <div className="bg-gray-800 rounded-2xl p-5 mb-6">
                            <div className="flex justify-between items-end mb-2">
                                <span className="text-sm font-bold text-gray-400">결제 후 파산 위험도</span>
                                <span className="text-2xl font-black text-red-500">{result.bankruptcyRisk}%</span>
                            </div>
                            <div className="w-full bg-gray-700 h-3 rounded-full overflow-hidden">
                                <div 
                                    className={`h-full risk-bar-fill ${result.bankruptcyRisk < 40 ? 'bg-green-500' : result.bankruptcyRisk < 70 ? 'bg-yellow-500' : 'bg-red-500'}`} 
                                    style={{ width: `${result.bankruptcyRisk}%` }}
                                ></div>
                            </div>
                            <p className="text-xs text-gray-400 mt-3 text-right">결제 후 예상 잔고: {(balance - result.itemPrice).toLocaleString()}원</p>
                        </div>

                        <div>
                            <h3 className="text-sm font-bold text-gray-400 mb-3 flex items-center gap-1">
                                <i className="ph ph-lightbulb"></i> AI가 추천하는 가성비 대안
                            </h3>
                            <div className="space-y-3">
                                {result.alternatives.map((alt, idx) => (
                                    <div key={idx} className="bg-gray-800 rounded-xl p-4 flex justify-between items-center border border-gray-700">
                                        <div>
                                            <div className="font-bold text-gray-200 mb-1">{alt.name}</div>
                                            <div className="text-green-400 font-bold text-sm">₩ {alt.price.toLocaleString()}</div>
                                        </div>
                                        <button className="bg-gray-700 text-xs px-3 py-2 rounded-lg font-bold hover:bg-gray-600">구매 링크</button>
                                    </div>
                                ))}
                            </div>
                        </div>
                        
                        <div className="mt-8 mb-4">
                            <button onClick={() => goToScreen(1)} className="w-full border border-gray-600 text-gray-300 font-bold py-4 rounded-xl hover:bg-gray-800 transition-colors">
                                처음으로 돌아가기
                            </button>
                        </div>
                    </main>
                )}

                {/* ================= 로딩 오버레이 ================= */}
                {isLoading && (
                    <div className="absolute inset-0 bg-gray-900 bg-opacity-80 z-50 flex flex-col items-center justify-center text-white backdrop-blur-sm">
                        <i className="ph ph-spinner-gap text-5xl animate-spin mb-4"></i>
                        <h3 className="text-xl font-bold mb-1">AI가 뜯어보는 중...</h3>
                        <p className="text-gray-400 text-sm">잔고와 장바구니를 대조하고 있습니다.</p>
                    </div>
                )}
            </div>
        </div>
    );
}