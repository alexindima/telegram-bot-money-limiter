import { Telegraf } from 'telegraf';
import * as dotenv from 'dotenv';
import { saveUser, getUser, updateUser, deleteUser } from './db';

dotenv.config();

const BOT_TOKEN = process.env.BOT_TOKEN;
if (!BOT_TOKEN) {
    throw new Error('Токен бота не найден. Убедитесь, что BOT_TOKEN указан в файле .env.');
}

const bot = new Telegraf(BOT_TOKEN);

bot.start((ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;

    saveUser(userId, 0, 0);
    ctx.reply('Привет! Сколько у тебя денег? Напиши сумму (например: 100).');
});

bot.command('help', (ctx) => {
    const helpMessage = `
        Доступные команды:
        /start - Начать работу с ботом.
        /status - Узнать текущий остаток и средний бюджет на оставшиеся дни.
        /refund <сумма> - Вернуть сумму в бюджет. Пример: /refund 20
        /setlimit <сумма> - Изменить общий лимит бюджета. Пример: /setlimit 500
        /setdays <дни> - Изменить количество оставшихся дней. Пример: /setdays 10
        /stop - Удалить все данные и остановить работу с ботом.
        /report - Показать список всех покупок.
        /help - Показать список доступных команд.
    `;
    ctx.reply(helpMessage);
});

bot.command('report', (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;

    const user = getUser(userId);
    if (!user) {
        ctx.reply('Данные не найдены. Сначала введи команду /start.');
        return;
    }

    const purchases = JSON.parse(user.purchases || '[]') as number[];
    if (purchases.length === 0) {
        ctx.reply('Вы ещё не совершали покупок.');
        return;
    }

    const report = purchases
        .map((amount, index) => `#${index + 1}: ${amount.toFixed(2)}`)
        .join('\n');
    ctx.reply(`Ваши покупки:\n${report}`);
});


bot.command('status', (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;

    const user = getUser(userId);
    if (!user) {
        ctx.reply('Данные не найдены. Сначала введи команду /start.');
        return;
    }

    const daysPassed = Math.floor((new Date().getTime() - new Date(user.startDate).getTime()) / (1000 * 60 * 60 * 24));
    const remainingDays = Math.max(user.days - daysPassed, 1);
    const dailyBudget = (user.totalAmount / remainingDays).toFixed(2);

    let response =
        `Ваш текущий остаток: ${user.totalAmount.toFixed(2)}.\n` +
        `Средний бюджет на оставшиеся ${remainingDays} дней: ${dailyBudget}.`;

    if (remainingDays > 1) {
        const futureDailyBudget = (user.totalAmount / (remainingDays - 1 || 1)).toFixed(2);
        response += `\nСредний бюджет на следующие дни без новых покупок сегодня: ${futureDailyBudget}.`;
    }

    ctx.reply(response);
});

bot.command('refund', (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;

    const messageParts = ctx.message.text.split(' ');
    const refundAmount = parseFloat(messageParts[1]?.replace(',', '.') || '');

    if (isNaN(refundAmount) || refundAmount <= 0) {
        ctx.reply('Пожалуйста, укажите корректную сумму для возврата. Пример: /refund 20');
        return;
    }

    const user = getUser(userId);
    if (!user) {
        ctx.reply('Данные не найдены. Сначала введи команду /start.');
        return;
    }

    const newTotalAmount = user.totalAmount + refundAmount;
    updateUser(userId, newTotalAmount, JSON.parse(user.purchases || '[]'));

    ctx.reply(`Сумма ${refundAmount} возвращена. Текущий остаток: ${newTotalAmount.toFixed(2)}.`);
});

bot.command('setlimit', (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;

    const messageParts = ctx.message.text.split(' ');
    const newLimit = parseFloat(messageParts[1]?.replace(',', '.') || '');

    if (isNaN(newLimit) || newLimit <= 0) {
        ctx.reply('Пожалуйста, укажите корректный новый лимит. Пример: /setlimit 500');
        return;
    }

    const user = getUser(userId);
    if (!user) {
        ctx.reply('Данные не найдены. Сначала введи команду /start.');
        return;
    }

    const purchases = JSON.parse(user.purchases || '[]');
    updateUser(userId, newLimit, purchases);

    ctx.reply(`Лимит бюджета изменен. Новый лимит: ${newLimit.toFixed(2)}.`);
});

bot.command('setdays', (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;

    const messageParts = ctx.message.text.split(' ');
    const newDays = parseInt(messageParts[1], 10);

    if (isNaN(newDays) || newDays <= 0) {
        ctx.reply('Пожалуйста, укажите корректное количество дней. Пример: /setdays 15');
        return;
    }

    const user = getUser(userId);
    if (!user) {
        ctx.reply('Данные не найдены. Сначала введи команду /start.');
        return;
    }

    saveUser(userId, user.totalAmount, newDays);

    ctx.reply(`Количество дней изменено. Новое количество дней: ${newDays}.`);
});

bot.command('stop', (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;

    const user = getUser(userId);
    if (!user) {
        ctx.reply('Данные не найдены. Сначала введи команду /start.');
        return;
    }

    deleteUser(userId); // Удаляем пользователя из базы данных
    ctx.reply('Ваши данные успешно удалены. Если захотите начать заново, используйте команду /start.');
});


bot.hears(/.*/, (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;

    const user = getUser(userId);
    if (!user) {
        saveUser(userId, 0, 0);
        ctx.reply('Сначала введи команду /start.');
        return;
    }

    const message = ctx.message.text;

    if (user.totalAmount === 0) {
        const amount = parseFloat(message.replace(',', '.'));
        if (isNaN(amount) || amount <= 0) {
            ctx.reply('Пожалуйста, введи корректную сумму.');
            return;
        }

        saveUser(userId, amount, 0);
        ctx.reply('На сколько дней рассчитаны эти деньги?');
        return;
    }

    if (user.days === 0) {
        const days = parseInt(message, 10);
        if (isNaN(days) || days <= 0) {
            ctx.reply('Пожалуйста, введи корректное количество дней.');
            return;
        }

        saveUser(userId, user.totalAmount, days);
        const dailyBudget = (user.totalAmount / days).toFixed(2);
        ctx.reply(`Твой средний бюджет на день: ${dailyBudget}. Чтобы добавить покупку, напиши сумму (например: 15).`);
        return;
    }

    const purchase = parseFloat(message.replace(',', '.'));
    if (!isNaN(purchase) && purchase > 0) {
        const purchases = JSON.parse(user.purchases || '[]') as number[];
        purchases.push(purchase);

        const newTotalAmount = user.totalAmount - purchase;
        updateUser(userId, newTotalAmount, purchases);

        const daysPassed = Math.floor((new Date().getTime() - new Date(user.startDate).getTime()) / (1000 * 60 * 60 * 24));
        const remainingDays = Math.max(user.days - daysPassed, 1);
        const dailyBudget = (newTotalAmount / remainingDays).toFixed(2);

        let response =
            `Покупка на сумму ${purchase} добавлена.\n` +
            `Остаток средств: ${newTotalAmount.toFixed(2)}.\n` +
            `Средний бюджет на оставшиеся ${remainingDays} дней: ${dailyBudget}.`;

        if (remainingDays > 1) {
            const futureDailyBudget = (newTotalAmount / (remainingDays - 1 || 1)).toFixed(2);
            response += `\nСредний бюджет на следующие дни без новых покупок сегодня: ${futureDailyBudget}.`;
        }

        ctx.reply(response);
    } else {
        ctx.reply('Пожалуйста, введи корректную сумму.');
    }
});

bot.launch().then(() => {
    console.log('Бот запущен!');
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
