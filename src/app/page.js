'use client'; 

import { useState } from 'react';

export default function Home() {
    // 💡 .env.local에 설정한 제미나이 API 키를 가져옵니다.
    const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;

    // 화면 및 상태 관리
    const [screen, setScreen] = useState(1);
    const [balance, setBalance] = useState(150000);
    const [inputMode, setInputMode] = useState('image'); 
    
    // 가계부 기능 상태 관리 (기존)
    const [income, setIncome] = useState(2000000); 
    const [expenses, setExpenses] = useState([]); 
    const [expenseName, setExpenseName] = useState(""); 
    const [expenseAmount, setExpenseAmount] = useState(""); 

    // 💡 [추가됨] 분야별 예산 상태 관리
    const [categories, setCategories] = useState([]);
    const [categoryName, setCategoryName] = useState("");
    const [categoryAmount, setCategoryAmount] = useState("");
    const [selectedCategory, setSelectedCategory] = useState(""); // 화면 2에서 선택할 예산 분야

    // 입력 데이터 상태
    const [imagePreview, setImagePreview] = useState(null);
    const [imageBase64, setImageBase64] = useState("");
    const [itemName, setItemName] = useState("");
    const [itemPrice, setItemPrice] = useState("");

    // 로딩 및 에러, 결과 상태
    const [isLoading, setIsLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState("");
    const [screen1Error, setScreen1Error] = useState(""); 
    const [result, setResult] = useState(null);

    // 실시간 콤마(,) 포맷팅 헬퍼 함수
    const formatWithCommas = (value) => {
        if (!value && value !== 0) return "";
        const numStr = value.toString().replace(/,/g, "");
        return numStr.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    };

    // 💡 [수정됨] 가계부 자동 계산 로직 (수입 - 고정 지출 - 분야별 예산)
    const totalExpenses = expenses.reduce((acc, curr) => acc + curr.amount, 0);
    const totalCategories = categories.reduce((acc, curr) => acc + curr.amount, 0);
    const budget = income - totalExpenses - totalCategories; 

    // 가계부 고정 지출 항목 추가 함수
    const handleAddExpense = () => {
        setScreen1Error(""); 

        const trimmedName = expenseName.trim();
        const rawAmount = expenseAmount.replace(/,/g, "");

        if (!trimmedName) {
            setScreen1Error("고정 지출 항목명을 입력해주세요.");
            return;
        }
        if (!rawAmount) {
            setScreen1Error("고정 지출 금액을 입력해주세요.");
            return;
        }

        const amountNum = Number(rawAmount);

        if (isNaN(amountNum) || amountNum <= 0) {
            setScreen1Error("지출 금액은 0원보다 커야 합니다.");
            return;
        }

        const newExpense = {
            id: Date.now(),
            name: trimmedName,
            amount: amountNum
        };

        setExpenses([...expenses, newExpense]);
        setExpenseName("");
        setExpenseAmount("");
    };

    const handleDeleteExpense = (id) => {
        setExpenses(expenses.filter(exp => exp.id !== id));
    };

    // 💡 [추가됨] 분야별 예산 추가 함수
    const handleAddCategory = () => {
        setScreen1Error("");

        const trimmedName = categoryName.trim();
        const rawAmount = categoryAmount.replace(/,/g, "");

        if (!trimmedName) {
            setScreen1Error("예산 분야명을 입력해주세요. (예: 쇼핑, 식비)");
            return;
        }
        if (!rawAmount) {
            setScreen1Error("해당 분야의 예산 금액을 입력해주세요.");
            return;
        }

        const amountNum = Number(rawAmount);

        if (isNaN(amountNum) || amountNum <= 0) {
            setScreen1Error("예산 금액은 0원보다 커야 합니다.");
            return;
        }

        const newCategory = {
            id: Date.now(),
            name: trimmedName,
            amount: amountNum,
        };

        setCategories([...categories, newCategory]);
        setCategoryName("");
        setCategoryAmount("");
    };

    const handleDeleteCategory = (id) => {
        setCategories(categories.filter((cat) => cat.id !== id));
        // 삭제된 분야가 선택되어 있었다면 초기화
        if (selectedCategory === categories.find(c => c.id === id)?.name) {
            setSelectedCategory("");
        }
    };

    const handleStart = () => {
        setScreen1Error("");
        if (income <= 0) {
            setScreen1Error("이번 달 총 수입을 0원보다 크게 입력해주세요.");
            return;
        }
        if (balance < 0) {
            setScreen1Error("현재 통장 잔고는 음수(-)가 될 수 없습니다.");
            return;
        }
        if (budget < 0) {
            setScreen1Error("고정 지출과 예산의 합이 총 수입보다 많습니다! 재정 상태를 다시 확인해주세요.");
            return;
        }
        goToScreen(2);
    };

    const goToScreen = (screenNumber) => {
        if (screenNumber === 2) {
            setInputMode('image');
            setImagePreview(null);
            setImageBase64("");
            setItemName("");
            setItemPrice("");
            setSelectedCategory(""); // 초기화
            setErrorMsg("");
        }
        setScreen(screenNumber);
    };

    const handleImageUpload = (event) => {
        const file = event.target.files[0];
        if (!file) return;

        if (!file.type.startsWith("image/")) {
            setErrorMsg("이미지 파일만 업로드할 수 있습니다.");
            return;
        }
        if (file.size > 4 * 1024 * 1024) {
            setErrorMsg("이미지 파일 크기는 최대 4MB까지 가능합니다.");
            return;
        }

        setErrorMsg("");
        const reader = new FileReader();
        reader.onload = (e) => {
            const dataUrl = e.target.result;
            setImagePreview(dataUrl);
            setImageBase64(dataUrl.split(',')[1]);
        };
        reader.readAsDataURL(file);
    };

    const isAnalyzeDisabled = inputMode === 'image' 
        ? !imageBase64 
        : !(itemName.trim() && itemPrice);

    // 지수 백오프 재시도 로직
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

    // AI 분석 시작
    const startAnalysis = async () => {
        if (isAnalyzeDisabled) return;
        if (!apiKey) {
            setErrorMsg("코드 상단에 제미나이 API 키를 먼저 입력해주세요!");
            return;
        }

        setErrorMsg("");

        if (inputMode === 'text') {
            const pureItemPrice = Number(itemPrice.replace(/,/g, ""));
            if (isNaN(pureItemPrice) || pureItemPrice <= 0) {
                setErrorMsg("상품 가격은 0원보다 커야 합니다.");
                return;
            }
        }

        // ⏳ 분석을 누르자마자 결과 스크린으로 이동하여 고급 스켈레톤을 노출합니다.
        setIsLoading(true);
        setScreen(3);

        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
        const pureItemPrice = Number(itemPrice.replace(/,/g, ""));

        // 💡 [수정됨] 분야 선택 여부에 따른 프롬프트 문구 추가
        const categoryContext = selectedCategory 
            ? `이 지출은 [${selectedCategory}] 예산에서 사용할 예정이야.` 
            : "";

        let requestContents = [];
        if (inputMode === 'image') {
            requestContents = [{
                "parts": [
                    { "text": `이번 달 남은 여유 자금: ${budget}원, 현재 통장 잔고: ${balance}원. ${categoryContext} 내가 지금 사려는 물건의 이미지야. 살까 말까? 분석해줘.` },
                    { "inlineData": { "mimeType": "image/jpeg", "data": imageBase64 } }
                ]
            }];
        } else {
            requestContents = [{
                "parts": [
                    { "text": `이번 달 남은 여유 자금: ${budget}원, 현재 통장 잔고: ${balance}원. ${categoryContext} 내가 사려는 물건은 '${itemName.trim()}' 이고, 가격은 ${pureItemPrice}원이야. 살까 말까? 분석해줘.` }
                ]
            }];
        }

        const payload = {
            "systemInstruction": {
                "parts": [{
                    "text": "너는 Z세대의 낭비 소비를 막아주는 매운맛 금융 코치 'AI 캐시가드'야. 유저가 사고싶은 물건의 정보(이미지 또는 텍스트)와 현재 잔고, 남은 예산, 그리고 사용하려는 특정 분야 예산을 제공할 거야. 이미지가 있다면 분석해서 제품명과 가격을 추정해. 그리고 이 물건을 사면 안 되는 이유를 아주 직설적이고 유머러스하게 비판(Roast)해. 파산 위험도를 0~100 사이로 계산해. 마지막으로 더 저렴한 가성비 대안 상품 2개를 추천해. 반드시 지정된 JSON 스키마에 맞춰서 응답해."
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
            
        } catch (error) {
            console.error("API Call Failed:", error);
            
            setIsLoading(false);
            setScreen(2); 
            setErrorMsg("현재 구글 AI 서버 혼잡(503) 또는 일시적 오류가 발생했습니다. 잠시 후 다시 [AI 평가 받기]를 눌러주세요!");
        }
    };

    return (
        <div className="text-gray-900 font-sans min-h-screen bg-gray-200">
            <style dangerouslySetInnerHTML={{__html: `
                body { font-family: 'Noto Sans KR', sans-serif; background-color: #e5e7eb; }
                .mobile-container { max-width: 400px; margin: 0 auto; background-color: #f9fafb; min-height: 100vh; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25); position: relative; overflow: hidden; }
                .risk-bar-fill { transition: width 1.5s cubic-bezier(0.4, 0, 0.2, 1); }
                
                @keyframes shimmer {
                    0% { background-position: -200% 0; }
                    100% { background-position: 200% 0; }
                }
                .skeleton-blink {
                    background: linear-gradient(90deg, #374151 25%, #4b5563 50%, #374151 75%);
                    background-size: 200% 100%;
                    animation: shimmer 1.5s infinite linear;
                }
            `}} />

            <div className="mobile-container flex flex-col">
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
                            {/* 총 수입 */}
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2">이번 달 총 수입</label>
                                <div className="relative">
                                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 font-bold text-gray-400">₩</span>
                                    <input 
                                        type="text" 
                                        className="w-full pl-8 pr-4 py-3 bg-white border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-800 font-bold" 
                                        value={formatWithCommas(income)}
                                        onChange={(e) => {
                                            const rawValue = e.target.value.replace(/[^0-9]/g, ''); 
                                            setIncome(rawValue === '' ? 0 : Number(rawValue));
                                        }}
                                    />
                                </div>
                            </div>

                            {/* 고정 지출 */}
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2">고정 지출 설정</label>
                                <div className="flex gap-2 mb-3">
                                    <input 
                                        type="text" 
                                        placeholder="항목 (예: 월세)" 
                                        className="flex-1 px-3 py-2 bg-white border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-800 text-sm"
                                        value={expenseName}
                                        onChange={(e) => setExpenseName(e.target.value)}
                                    />
                                    <input 
                                        type="text" 
                                        placeholder="금액" 
                                        className="w-28 px-3 py-2 bg-white border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-800 text-sm"
                                        value={formatWithCommas(expenseAmount)}
                                        onChange={(e) => {
                                            const rawValue = e.target.value.replace(/[^0-9]/g, ''); 
                                            setExpenseAmount(rawValue);
                                        }}
                                    />
                                    <button 
                                        type="button"
                                        onClick={handleAddExpense}
                                        className="bg-gray-800 text-white px-3 py-2 rounded-xl text-xs font-bold hover:bg-gray-700 active:scale-95 transition-transform"
                                    >
                                        추가
                                    </button>
                                </div>

                                <div className="bg-gray-100 p-3 rounded-xl border border-gray-200 max-h-36 overflow-y-auto space-y-2">
                                    {expenses.length === 0 ? (
                                        <p className="text-gray-400 text-xs text-center py-2">등록된 고정 지출이 없습니다.</p>
                                    ) : (
                                        expenses.map(exp => (
                                            <div key={exp.id} className="flex justify-between items-center text-xs bg-white p-2 rounded-lg border border-gray-100 shadow-sm">
                                                <span className="font-medium text-gray-700">{exp.name}</span>
                                                <div className="flex items-center gap-2">
                                                    <span className="font-bold text-red-500">-{exp.amount.toLocaleString()}원</span>
                                                    <button 
                                                        type="button" 
                                                        onClick={() => handleDeleteExpense(exp.id)}
                                                        className="text-gray-400 hover:text-red-500 font-bold ml-1"
                                                    >
                                                        ✕
                                                    </button>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>

                            {/* 💡 [추가됨] 분야별 변동 지출 예산 */}
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2">분야별 예산 설정 <span className="text-xs text-gray-400 font-normal">(선택)</span></label>
                                <div className="flex gap-2 mb-3">
                                    <input
                                        type="text"
                                        placeholder="분야 (예: 쇼핑, 식비)"
                                        className="flex-1 px-3 py-2 bg-white border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-800 text-sm"
                                        value={categoryName}
                                        onChange={(e) => setCategoryName(e.target.value)}
                                    />
                                    <input
                                        type="text"
                                        placeholder="예산 금액"
                                        className="w-28 px-3 py-2 bg-white border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-800 text-sm"
                                        value={formatWithCommas(categoryAmount)}
                                        onChange={(e) => {
                                            const rawValue = e.target.value.replace(/[^0-9]/g, "");
                                            setCategoryAmount(rawValue);
                                        }}
                                    />
                                    <button
                                        type="button"
                                        onClick={handleAddCategory}
                                        className="bg-blue-600 text-white px-3 py-2 rounded-xl text-xs font-bold hover:bg-blue-700 active:scale-95 transition-transform"
                                    >
                                        추가
                                    </button>
                                </div>

                                <div className="bg-blue-50 p-3 rounded-xl border border-blue-100 max-h-36 overflow-y-auto space-y-2">
                                    {categories.length === 0 ? (
                                        <p className="text-blue-400 text-xs text-center py-2">등록된 분야별 예산이 없습니다.</p>
                                    ) : (
                                        categories.map((cat) => (
                                            <div key={cat.id} className="flex justify-between items-center text-xs bg-white p-2 rounded-lg border border-blue-100 shadow-sm">
                                                <span className="font-bold text-blue-700">{cat.name}</span>
                                                <div className="flex items-center gap-2">
                                                    <span className="font-bold text-blue-600">-{cat.amount.toLocaleString()}원</span>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleDeleteCategory(cat.id)}
                                                        className="text-blue-300 hover:text-red-500 font-bold ml-1"
                                                    >
                                                        ✕
                                                    </button>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>

                            {/* 💡 [수정됨] 자동 계산된 남은 생활비 (수입 - 고정 지출 - 분야별 예산) */}
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2">할당되지 않은 남은 여유 자금</label>
                                <div className="relative">
                                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 font-bold text-gray-400">₩</span>
                                    <input 
                                        type="text" 
                                        className={`w-full pl-8 pr-4 py-3 border border-gray-300 rounded-xl font-bold cursor-not-allowed ${budget < 0 ? 'bg-red-50 text-red-600 border-red-300' : 'bg-gray-100 text-gray-800'}`} 
                                        value={budget.toLocaleString() + " 원"}
                                        disabled
                                    />
                                </div>
                            </div>

                            {/* 현재 잔고 */}
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2">현재 통장 실제 잔고</label>
                                <div className="relative">
                                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 font-bold text-gray-400">₩</span>
                                    <input 
                                        type="text" 
                                        className="w-full pl-8 pr-4 py-3 bg-white border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-800 font-bold" 
                                        value={formatWithCommas(balance)}
                                        onChange={(e) => {
                                            const rawValue = e.target.value.replace(/[^0-9]/g, ''); 
                                            setBalance(rawValue === '' ? 0 : Number(rawValue));
                                        }}
                                    />
                                </div>
                            </div>
                        </div>

                        {screen1Error && <div className="text-red-600 text-xs font-bold text-center mt-4 bg-red-50 py-2 rounded-xl border border-red-100">{screen1Error}</div>}

                        <div className="mt-auto pt-8">
                            <button onClick={handleStart} className="w-full bg-gray-900 text-white font-bold py-4 rounded-xl hover:bg-gray-800 active:scale-95 transition-transform flex justify-center items-center gap-2">
                                시작하기 <i className="ph ph-arrow-right font-bold"></i>
                            </button>
                        </div>
                    </main>
                )}

                {/* ================= Screen 2: 사고 싶은 물건 정보 입력 ================= */}
                {screen === 2 && (
                    <main className="flex-1 flex flex-col p-6 overflow-y-auto">
                        <div className="mb-6 mt-4 flex items-center gap-2">
                            <button onClick={() => setScreen(1)} className="p-2 -ml-2 text-gray-500 hover:text-gray-900 rounded-full">
                                <i className="ph ph-caret-left text-xl"></i>
                            </button>
                            <h2 className="text-2xl font-bold">살까 말까 고민되나요?</h2>
                        </div>
                        <p className="text-gray-500 text-sm mb-6">사고 싶은 물건을 캡처해서 올리거나 직접 입력해주세요. AI가 결제를 허락할지 판단합니다.</p>

                        <div className="flex bg-gray-200 p-1 rounded-lg mb-6">
                            <button onClick={() => setInputMode('image')} className={`flex-1 py-2 text-sm font-bold rounded-md ${inputMode === 'image' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:bg-gray-300'}`}>캡처 업로드</button>
                            <button onClick={() => setInputMode('text')} className={`flex-1 py-2 text-sm font-bold rounded-md ${inputMode === 'text' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:bg-gray-300'}`}>직접 입력</button>
                        </div>

                        <div className="flex-1 flex flex-col items-center justify-center w-full">
                            {inputMode === 'image' && (
                                <div className="w-full">
                                    <label htmlFor="image-upload" className="w-full h-64 border-2 border-dashed border-gray-400 rounded-2xl flex flex-col items-center justify-center cursor-pointer hover:bg-gray-100 transition-colors bg-white relative overflow-hidden">
                                        {!imagePreview ? (
                                            <div className="flex flex-col items-center pointer-events-none">
                                                <i className="ph ph-image text-4xl text-gray-400 mb-2"></i>
                                                <span className="text-gray-500 font-medium">터치하여 캡처 이미지 업로드</span>
                                                <span className="text-gray-400 text-xs mt-1">지정 가능 용량: 최대 4MB</span>
                                            </div>
                                        ) : (
                                            <img src={imagePreview} className="absolute inset-0 w-full h-full object-cover" alt="미리보기" />
                                        )}
                                        <input id="image-upload" type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                                    </label>
                                </div>
                            )}

                            {inputMode === 'text' && (
                                <div className="w-full space-y-4">
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-2">상품명</label>
                                        <input type="text" maxLength={40} placeholder="예: 나이키 에어포스 1" className="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-800 font-bold" value={itemName} onChange={(e) => setItemName(e.target.value)} />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-2">가격</label>
                                        <div className="relative">
                                            <span className="absolute inset-y-0 left-0 flex items-center pl-3 font-bold text-gray-400">₩</span>
                                            <input 
                                                type="text" 
                                                placeholder="예: 139,000" 
                                                className="w-full pl-8 pr-4 py-3 bg-white border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-800 font-bold" 
                                                value={formatWithCommas(itemPrice)} 
                                                onChange={(e) => {
                                                    const rawValue = e.target.value.replace(/[^0-9]/g, ''); 
                                                    setItemPrice(rawValue);
                                                }} 
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* 💡 [추가됨] 예산 분야 선택 드롭다운 (등록된 분야가 있을 때만 노출) */}
                        {categories.length > 0 && (
                            <div className="mt-6">
                                <label className="block text-sm font-bold text-gray-700 mb-2">이 지출은 어느 예산에서 빠져나가나요?</label>
                                <select 
                                    className="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-800 text-sm font-medium"
                                    value={selectedCategory}
                                    onChange={(e) => setSelectedCategory(e.target.value)}
                                >
                                    <option value="">-- 분야 선택 안 함 (여유 자금에서 차감) --</option>
                                    {categories.map((cat) => (
                                        <option key={cat.id} value={cat.name}>
                                            {cat.name} (남은 예산: {cat.amount.toLocaleString()}원)
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}

                        {errorMsg && <div className="text-red-600 text-sm font-bold text-center mt-4 bg-red-50 p-3 rounded-xl border border-red-100 leading-normal">{errorMsg}</div>}

                        <div className="mt-8">
                            <button onClick={startAnalysis} disabled={isAnalyzeDisabled} className="w-full bg-gray-900 text-white font-bold py-4 rounded-xl hover:bg-gray-800 active:scale-95 transition-transform flex justify-center items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
                                AI 평가 받기 <i className="ph ph-magnifying-glass font-bold"></i>
                            </button>
                        </div>
                    </main>
                )}

                {/* ================= Screen 3: 결과 화면 OR 스켈레톤 애니메이션 ================= */}
                {screen === 3 && (
                    <main className="flex-1 flex flex-col p-6 overflow-y-auto bg-gray-900 text-white">
                        
                        {isLoading ? (
                            <div className="flex-1 flex flex-col">
                                <div className="flex justify-between items-center mb-8 mt-2">
                                    <div className="w-6 h-6 bg-gray-800 rounded-full"></div>
                                    <div className="w-20 h-6 bg-gray-800 rounded-full"></div>
                                </div>

                                <div className="flex flex-col items-center mb-8">
                                    <div className="w-16 h-16 bg-gray-800 rounded-full mb-4 skeleton-blink"></div>
                                    <div className="w-36 h-8 bg-gray-800 rounded-lg mb-3 skeleton-blink"></div>
                                    <div className="w-48 h-4 bg-gray-800 rounded-md skeleton-blink"></div>
                                </div>

                                <div className="bg-gray-800 rounded-2xl p-6 mb-6 h-24 flex flex-col gap-2 justify-center">
                                    <div className="w-full h-4 bg-gray-700 rounded skeleton-blink"></div>
                                    <div className="w-4/5 h-4 bg-gray-700 rounded skeleton-blink"></div>
                                </div>

                                <div className="bg-gray-800 rounded-2xl p-5 mb-6">
                                    <div className="flex justify-between items-center mb-4">
                                        <div className="w-24 h-4 bg-gray-700 rounded skeleton-blink"></div>
                                        <div className="w-12 h-6 bg-gray-700 rounded skeleton-blink"></div>
                                    </div>
                                    <div className="w-full bg-gray-700 h-3 rounded-full skeleton-blink"></div>
                                </div>

                                <div className="w-36 h-4 bg-gray-800 rounded mb-4 skeleton-blink"></div>
                                
                                <div className="space-y-3">
                                    {[1, 2].map((i) => (
                                        <div key={i} className="bg-gray-800 rounded-xl p-4 flex justify-between items-center border border-gray-700">
                                            <div className="space-y-2 w-2/3">
                                                <div className="w-full h-4 bg-gray-700 rounded skeleton-blink"></div>
                                                <div className="w-20 h-4 bg-gray-700 rounded skeleton-blink"></div>
                                            </div>
                                            <div className="w-16 h-8 bg-gray-700 rounded-lg skeleton-blink"></div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            result && (
                                <>
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
                                        <p className="text-lg font-bold leading-relaxed text-red-400">"{result.roastMessage}"</p>
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
                                </>
                            )
                        )}
                    </main>
                )}
            </div>
        </div>
    );
}