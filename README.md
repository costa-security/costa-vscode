# costa-vscode

<a href="https://marketplace.visualstudio.com/items?itemName=antfu.ext-name" target="__blank"><img src="https://img.shields.io/visual-studio-marketplace/v/antfu.ext-name.svg?color=eee&amp;label=VS%20Code%20Marketplace&logo=visual-studio-code" alt="Visual Studio Marketplace Version" /></a>
<a href="https://kermanx.github.io/reactive-vscode/" target="__blank"><img src="https://img.shields.io/badge/made_with-reactive--vscode-%23007ACC?style=flat&labelColor=%23229863"  alt="Made with reactive-vscode" /></a>

## Configurations

<!-- configs -->

| Key                        | Description                                                                           | Type     | Default                                         |
| -------------------------- | ------------------------------------------------------------------------------------- | -------- | ----------------------------------------------- |
| `costa.apiToken`           | API token for connecting to the Costa service (deprecated - use OAuth2 login instead) | `string` | `""`                                            |
| `costa.apiBaseUrl`         | Base URL for the Costa API                                                            | `string` | `"https://ai.costa.app"`                        |
| `costa.oauth2.clientId`    | OAuth2 client ID for this VS Code extension                                           | `string` | `"e8YclcbCo5Pzac7KtFNoKWSpcs9FcZvBsHqMKKfpvMU"` |
| `costa.oauth2.redirectUri` | OAuth2 redirect URI for this VS Code extension                                        | `string` | `"vscode://costa.costa-code/callback"`          |

<!-- configs -->

## Commands

<!-- commands -->

| Command        | Title                |
| -------------- | -------------------- |
| `costa.login`  | Costa: Costa: Login  |
| `costa.logout` | Costa: Costa: Logout |

<!-- commands -->

## Sponsors

<p align="center">
  <a href="https://cdn.jsdelivr.net/gh/antfu/static/sponsors.svg">
    <img src='https://cdn.jsdelivr.net/gh/antfu/static/sponsors.png'/>
  </a>
</p>

## License

[MIT](./LICENSE.md) License © 2022 [Anthony Fu](https://github.com/antfu)
