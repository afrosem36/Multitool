import { formatAmountINR, formatNumberIN } from '../../utils/formatters';

export function parseAmount(value, fallback = 0) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : fallback;
}

export function getMonthlySnapshot(state) {
  const income = parseAmount(state?.income?.monthlyTakeHome, 50000);
  const expenses = {
    home: parseAmount(state?.expenses?.home),
    emis: parseAmount(state?.expenses?.emis),
    food: parseAmount(state?.expenses?.food),
    transport: parseAmount(state?.expenses?.transport),
    lifestyle: parseAmount(state?.expenses?.lifestyle),
    others: parseAmount(state?.expenses?.others),
  };

  const totalExpenses = Object.values(expenses).reduce((sum, value) => sum + value, 0);
  const surplus = income - totalExpenses;
  const savingsRate = income > 0 ? Number(((surplus / income) * 100).toFixed(1)) : 0;
  const expenseRatio = income > 0 ? Number(((totalExpenses / income) * 100).toFixed(1)) : 0;
  const emergencyFundMonths = totalExpenses > 0
    ? Number((parseAmount(state?.savings?.liquidSavings) / totalExpenses).toFixed(1))
    : 0;

  return {
    income,
    expenses,
    totalExpenses,
    surplus,
    savingsRate,
    expenseRatio,
    emergencyFundMonths,
  };
}

export function getExpenseChartData(expenses) {
  return [
    { name: 'Home', value: expenses.home },
    { name: 'EMIs', value: expenses.emis },
    { name: 'Food', value: expenses.food },
    { name: 'Transport', value: expenses.transport },
    { name: 'Lifestyle', value: expenses.lifestyle },
    { name: 'Others', value: expenses.others },
  ].filter((item) => item.value > 0);
}

export function formatInrAmount(value, options = {}) {
  return formatAmountINR(value, options);
}

export function formatInrNumber(value) {
  return formatNumberIN(value);
}

export function formatCompactInr(value) {
  const numericValue = parseAmount(value);
  if (numericValue >= 10000000) {
    return `Rs. ${new Intl.NumberFormat('en-IN', {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    }).format(numericValue / 10000000)} Cr`;
  }

  if (numericValue >= 100000) {
    return `Rs. ${new Intl.NumberFormat('en-IN', {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    }).format(numericValue / 100000)} L`;
  }

  return formatAmountINR(numericValue);
}
