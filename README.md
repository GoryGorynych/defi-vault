# Sample Hardhat Project

This project demonstrates a basic Hardhat use case. It comes with a sample contract, a test for that contract, and a Hardhat Ignition module that deploys that contract.

Try running some of the following tasks:

```shell
npx hardhat help
npx hardhat test
REPORT_GAS=true npx hardhat test
npx hardhat node
npx hardhat ignition deploy ./ignition/modules/Lock.js
```
### Dev notes
contracts/
1. TacoCoin.sol - ERC20 токен с permit.
2. Vault.sol - обновляемый UUPS прокси с поддержкой мета-транзакций. 
Хранилище для TacoCoin, реализует функционал стейкинга. \
Функции: \
deposit() — внести токены через permit. \
withdraw() — вывести токены. \
claimRewards() — получить награды.
3. VaultV2.sol, VaultV3.sol - другие реализации Vault, ничего нового не добавляют, только версию имплементации.
4. Relayer.sol - ретранслятор для мета транзакций, библиотечный ERC2771Forwarder
5. utils/ERC2771Simple.sol - легковесная реализация ERC2771, реализует функции msgSender и msgData.
Интегрируется в Vault.
6. VaultFactory.sol - фабрика необновляемых контрактов Vault, создает minimal proxy контракты по стандарту ERC-1167.
Используется не зависимо от UUPS proxy, только для демонстрации.